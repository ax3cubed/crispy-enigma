'use strict'

/**
 * Custom Node.js server: Express + ltijs + Next.js
 *
 * ltijs is an Express-based library that is incompatible with the Next.js App Router
 * edge/serverless runtime. This file wires all three layers together:
 *
 *   /lti/login   → ltijs OIDC login initiation
 *   /lti/launch  → ltijs OIDC callback + JWT validation → onConnect → redirect to Next.js page
 *   /lti/keys    → ltijs JWKS public key endpoint (register this URL with saLTIre)
 *   /api/lti/*   → ltijs-protected Express routes (AGS, NRPS, Deep Linking)
 *   /*           → Next.js App Router (pages + public API routes)
 *
 * saLTIre registration values (after `npm run dev`):
 *   OIDC Login URL  : http://localhost:3000/lti/login
 *   Launch URL      : http://localhost:3000/lti/launch
 *   Deep Link URL   : http://localhost:3000/lti/launch  (same endpoint; ltijs routes by message_type)
 *   JWKS URL        : http://localhost:3000/lti/keys
 *   Redirect URI    : http://localhost:3000/lti/launch
 */

require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const express = require('express')
const next = require('next')
const { lti, registerPlatformFromEnv } = require('./src/lib/lti/provider')
const { ltiRouter } = require('./src/lib/lti/routes')

const PORT = parseInt(process.env.PORT ?? '3000', 10)
const dev = process.env.NODE_ENV !== 'production'

const nextApp = next({ dev })
const nextHandle = nextApp.getRequestHandler()

// ─── ltijs launch handlers ────────────────────────────────────────────────────

/**
 * onConnect: called after a successful LTI 1.3 Resource Link launch.
 * Redirects the browser to the appropriate Next.js page based on the user's role.
 */
lti.onConnect((token, req, res) => {
  const roles = token.roles ?? []
  const isInstructor = roles.some(
    (r) => r.includes('Instructor') || r.includes('TeachingAssistant') || r.includes('Administrator')
  )

  console.log(
    `[LTI] Launch — user: ${token.user}, roles: ${roles.join(', ')}, ` +
      `context: ${token.platformContext?.context?.id ?? 'n/a'}`
  )

  if (isInstructor) {
    return lti.redirect(res, '/instructor')
  }
  return lti.redirect(res, '/tool')
})

/**
 * onDeepLinking: called when the platform sends an LtiDeepLinkingRequest.
 * Redirects to the Deep Linking UI page where the instructor selects/creates an assessment.
 */
lti.onDeepLinking((token, req, res) => {
  console.log(`[LTI] Deep Linking request — user: ${token.user}`)
  return lti.redirect(res, '/deep-link')
})

/**
 * onInvalidToken: called when the id_token fails validation.
 */
lti.onInvalidToken((req, res, err) => {
  console.error('[LTI] Invalid token:', err?.message ?? err)
  res.status(401).json({
    error: 'INVALID_LTI_TOKEN',
    message:
      'The LTI 1.3 id_token is invalid or could not be verified. ' +
      'Ensure the tool is registered correctly with the platform.',
  })
})

/**
 * onSessionTimeout: called when the LTIK cookie has expired.
 */
lti.onSessionTimeout((req, res, err) => {
  console.warn('[LTI] Session timeout:', err?.message ?? err)
  res.status(401).json({
    error: 'LTI_SESSION_EXPIRED',
    message: 'Your LTI session has expired. Please re-launch the tool from the LMS.',
  })
})

// ─── Startup ──────────────────────────────────────────────────────────────────

async function start() {
  // Prepare the Next.js app (compiles pages in dev mode)
  await nextApp.prepare()

  // Connect ltijs to its SQLite database and generate/load its RSA key pair
  await lti.deploy({ serverless: true })

  // Register the configured platform (reads PLATFORM_* env vars)
  await registerPlatformFromEnv()

  // Build the Express application
  const app = express()
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  // Mount ltijs-protected LTI service API routes
  // lti.protect validates the LTIK cookie and sets res.locals.token
  app.use('/api/lti', lti.protect, ltiRouter)

  // Mount the ltijs router (handles /lti/login, /lti/launch, /lti/keys, etc.)
  app.use(lti.app)

  // All remaining requests are handled by Next.js
  app.all('*', (req, res) => nextHandle(req, res))

  app.listen(PORT, () => {
    console.log(`\n[Server] Running on http://localhost:${PORT}`)
    console.log('[Server] saLTIre registration values:')
    console.log(`  OIDC Login URL : http://localhost:${PORT}/lti/login`)
    console.log(`  Launch URL     : http://localhost:${PORT}/lti/launch`)
    console.log(`  Deep Link URL  : http://localhost:${PORT}/lti/launch`)
    console.log(`  JWKS URL       : http://localhost:${PORT}/lti/keys`)
    console.log(`  Redirect URI   : http://localhost:${PORT}/lti/launch\n`)
  })
}

start().catch((err) => {
  console.error('[Server] Fatal startup error:', err)
  process.exit(1)
})
