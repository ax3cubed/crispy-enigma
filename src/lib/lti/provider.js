'use strict'

/**
 * ltijs Provider singleton.
 *
 * ltijs is a CommonJS Express-based library. It must be required (not imported)
 * and configured exactly once per process. All LTI-aware code imports this module
 * to share the same Provider instance.
 */

const { Provider: lti } = require('ltijs')
const Database = require('ltijs-sequelize')
const path = require('path')
const { URL } = require('url')

const LTI_KEY = process.env.LTI_KEY ?? 'INSECURE_DEFAULT_KEY_CHANGE_IN_PRODUCTION'

// Choose database engine based on environment. In production use a proper
// RDS/managed DB (Postgres) via LTI_DB_URL or DATABASE_URL. Otherwise fall
// back to SQLite for local development (requires sqlite3 installed in dev).
let db
const ltiDbUrl = process.env.LTI_DB_URL ?? process.env.DATABASE_URL
if (ltiDbUrl) {
  // Parse a connection URL like postgres://user:pass@host:port/dbname
  const parsed = new URL(ltiDbUrl)
  const proto = parsed.protocol.replace(':', '')
  const dialect = proto === 'postgresql' ? 'postgres' : proto
  const dbName = parsed.pathname ? parsed.pathname.replace(/^\//, '') : undefined
  const dbUser = parsed.username || null
  const dbPass = parsed.password || null

  db = new Database(dbName, dbUser, dbPass, {
    dialect,
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : undefined,
    logging: false,
    dialectOptions: dialect === 'postgres' ? { ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined } : undefined,
  })
} else {
  const LTI_DB_PATH = process.env.LTI_DB_PATH ?? path.join(process.cwd(), 'lti.db')
  // ltijs-sequelize with SQLite dialect. For SQLite, username/password/database
  // name are irrelevant — storage path is all that matters.
  db = new Database('ltidb', null, null, {
    dialect: 'sqlite',
    storage: LTI_DB_PATH,
    logging: false,
  })
}

lti.setup(LTI_KEY, db, {
  appRoute: '/lti/launch',
  loginRoute: '/lti/login',
  // devMode disables HTTPS-only cookie enforcement for local development.
  // Set to false and enable secure cookies in production.
  devMode: process.env.NODE_ENV !== 'production',
  cookies: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : '',
  },
  tokenMaxAge: false, // tokens do not expire (useful for testing; set a value in production)
})

/**
 * Register the saLTIre (or any configured) platform if not already registered.
 * Called once at server startup. Safe to call multiple times — ltijs deduplicates.
 */
async function registerPlatformFromEnv() {
  const url = process.env.PLATFORM_URL
  const clientId = process.env.PLATFORM_CLIENT_ID
  const authEndpoint = process.env.PLATFORM_AUTH_ENDPOINT
  const tokenEndpoint = process.env.PLATFORM_TOKEN_ENDPOINT
  const jwksUrl = process.env.PLATFORM_JWKS_URL

  if (!url || !clientId) {
    console.warn(
      '[LTI] PLATFORM_URL or PLATFORM_CLIENT_ID not set. ' +
        'Platform will not be pre-registered. Set these in .env to enable launches from saLTIre.'
    )
    return
  }

  try {
    await lti.registerPlatform({
      url,
      name: 'saLTIre',
      clientId,
      authenticationEndpoint: authEndpoint ?? `${url}/platform/auth`,
      accesstokenEndpoint: tokenEndpoint ?? `${url}/platform/token`,
      authConfig: {
        method: 'JWK_SET',
        key: jwksUrl ?? `${url}/platform/jwks`,
      },
    })
    console.log(`[LTI] Platform registered: ${url} (client_id: ${clientId})`)
  } catch (err) {
    // If the platform is already registered ltijs may throw — treat as non-fatal
    if (err.message && err.message.includes('already')) {
      console.log(`[LTI] Platform already registered: ${url}`)
    } else {
      console.error('[LTI] Failed to register platform:', err.message)
    }
  }
}

module.exports = { lti, registerPlatformFromEnv }
