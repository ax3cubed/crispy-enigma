'use strict'

/**
 * Express routes protected by ltijs middleware (lti.protect).
 *
 * When lti.protect runs, it validates the LTIK cookie and exposes the decoded
 * token on res.locals.token. All routes here can safely access res.locals.token.
 *
 * Mount point: app.use('/api/lti', lti.protect, ltiRouter)
 */

const { Router } = require('express')
const { lti } = require('./provider')

const router = Router()

// ─── GET /api/lti/context ──────────────────────────────────────────────────────
// Returns the current user's LTI context: identity, roles, course info, service URLs.
// Next.js pages call this on mount to hydrate their state.
router.get('/context', (req, res) => {
  const token = res.locals.token

  const roles = token.roles ?? []
  const isInstructor = roles.some(
    (r) => r.includes('Instructor') || r.includes('TeachingAssistant') || r.includes('Administrator')
  )

  res.json({
    user: {
      id: token.user,
      name: token.userInfo?.name ?? null,
      email: token.userInfo?.email ?? null,
      givenName: token.userInfo?.given_name ?? null,
      familyName: token.userInfo?.family_name ?? null,
    },
    roles,
    isInstructor,
    context: token.platformContext?.context ?? null,
    resourceLink: token.platformContext?.resource ?? null,
    customParams: token.platformContext?.custom ?? {},
    messageType: token.platformContext?.['https://purl.imsglobal.org/spec/lti/claim/message_type'] ?? null,
    // These are present only if the platform supports the respective services
    agsEndpoint: token.platformContext?.endpoint ?? null,
    nrpsEndpoint: token.platformContext?.namesRoles ?? null,
    deploymentId: token.deploymentId ?? null,
    platformId: token.iss ?? null,
  })
})

// ─── GET /api/lti/roster ──────────────────────────────────────────────────────
// Returns course roster via NRPS. Only succeeds if the platform included the
// https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice claim.
router.get('/roster', async (req, res) => {
  const token = res.locals.token

  if (!token.platformContext?.namesRoles) {
    return res.status(400).json({
      error: 'NRPS_NOT_AVAILABLE',
      message:
        'The platform did not include the Names and Roles Provisioning Service claim. ' +
        'Enable NRPS in the saLTIre platform configuration.',
    })
  }

  try {
    const result = await lti.NamesAndRoles.getMembers(token)
    res.json({
      members: result.members ?? [],
      nextPage: result.next ?? null,
    })
  } catch (err) {
    console.error('[NRPS] getMembers failed:', err.message)
    res.status(502).json({ error: 'NRPS_CALL_FAILED', message: err.message })
  }
})

// ─── GET /api/lti/lineitems ───────────────────────────────────────────────────
// Lists AGS line items (grade columns) for the current context.
// Requires the https://purl.imsglobal.org/spec/lti-ags/claim/endpoint claim.
router.get('/lineitems', async (req, res) => {
  const token = res.locals.token

  if (!token.platformContext?.endpoint) {
    return res.status(400).json({
      error: 'AGS_NOT_AVAILABLE',
      message:
        'The platform did not include the Assignment and Grade Services claim. ' +
        'Enable AGS in the saLTIre platform configuration.',
    })
  }

  try {
    const lineItems = await lti.Grade.getLineItems(token)
    res.json({ lineItems: lineItems ?? [] })
  } catch (err) {
    console.error('[AGS] getLineItems failed:', err.message)
    res.status(502).json({ error: 'AGS_LINEITEMS_FAILED', message: err.message })
  }
})

// ─── POST /api/lti/lineitems ──────────────────────────────────────────────────
// Creates a new AGS line item (grade column) for this resource link.
// Body: { label: string, scoreMaximum: number, resourceId?: string, tag?: string }
router.post('/lineitems', async (req, res) => {
  const token = res.locals.token

  if (!token.platformContext?.endpoint) {
    return res.status(400).json({ error: 'AGS_NOT_AVAILABLE', message: 'AGS endpoint not present in launch token.' })
  }

  const { label, scoreMaximum, resourceId, tag } = req.body ?? {}

  if (!label || !scoreMaximum) {
    return res.status(400).json({ error: 'INVALID_BODY', message: 'label and scoreMaximum are required.' })
  }

  try {
    const lineItem = await lti.Grade.createLineItem(token, {
      scoreMaximum: Number(scoreMaximum),
      label,
      resourceId: resourceId ?? undefined,
      tag: tag ?? 'grade',
      resourceLinkId: token.platformContext?.resource?.id ?? undefined,
    })
    res.status(201).json({ lineItem })
  } catch (err) {
    console.error('[AGS] createLineItem failed:', err.message)
    res.status(502).json({ error: 'AGS_CREATE_LINEITEM_FAILED', message: err.message })
  }
})

// ─── POST /api/lti/scores ─────────────────────────────────────────────────────
// Submits a rubric-driven score to the LMS gradebook via AGS.
//
// Body:
//   lineItemId      string   — AGS line item URL (from GET /api/lti/lineitems)
//   scoreGiven      number   — numeric score awarded
//   scoreMaximum    number   — maximum possible score
//   comment         string   — rubric breakdown summary (visible in LMS gradebook)
//   activityProgress string  — "Initialized"|"Started"|"InProgress"|"Submitted"|"Completed"
//   gradingProgress  string  — "FullyGraded"|"Pending"|"PendingManual"|"Failed"|"NotReady"
//
// NOTE: QTI does NOT submit this score. AGS is the only standard grade passback mechanism.
// Rubric criteria (if sourced from QTI) are summarised into the comment field here.
router.post('/scores', async (req, res) => {
  const token = res.locals.token

  if (!token.platformContext?.endpoint) {
    return res.status(400).json({ error: 'AGS_NOT_AVAILABLE', message: 'AGS endpoint not present in launch token.' })
  }

  const {
    lineItemId,
    scoreGiven,
    scoreMaximum,
    comment,
    activityProgress = 'Completed',
    gradingProgress = 'FullyGraded',
  } = req.body ?? {}

  if (!lineItemId || scoreGiven == null || !scoreMaximum) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: 'lineItemId, scoreGiven, and scoreMaximum are required.',
    })
  }

  const gradePayload = {
    userId: token.user,
    scoreGiven: Number(scoreGiven),
    scoreMaximum: Number(scoreMaximum),
    activityProgress,
    gradingProgress,
    timestamp: new Date().toISOString(),
    comment: comment ?? undefined,
  }

  try {
    const result = await lti.Grade.submitScore(token, lineItemId, gradePayload)
    res.json({
      success: true,
      gradePayload,
      agsResponse: result,
    })
  } catch (err) {
    console.error('[AGS] submitScore failed:', err.message)
    res.status(502).json({ error: 'AGS_SUBMIT_SCORE_FAILED', message: err.message })
  }
})

// ─── GET /api/lti/results ─────────────────────────────────────────────────────
// Reads back submitted results from the AGS results endpoint.
// Query param: lineItemId (URL of the line item)
router.get('/results', async (req, res) => {
  const token = res.locals.token

  if (!token.platformContext?.endpoint) {
    return res.status(400).json({ error: 'AGS_NOT_AVAILABLE', message: 'AGS endpoint not present in launch token.' })
  }

  const { lineItemId } = req.query

  if (!lineItemId) {
    return res.status(400).json({ error: 'INVALID_QUERY', message: 'lineItemId query parameter is required.' })
  }

  try {
    const results = await lti.Grade.getScores(token, lineItemId)
    res.json({ results: results ?? [] })
  } catch (err) {
    console.error('[AGS] getScores failed:', err.message)
    res.status(502).json({ error: 'AGS_GET_RESULTS_FAILED', message: err.message })
  }
})

// ─── POST /api/lti/deep-link/response ─────────────────────────────────────────
// Builds and signs a Deep Linking response JWT containing an LtiResourceLink
// content item, then returns an HTML form that auto-submits to the LMS.
//
// Body:
//   title         string — Assessment title shown in the LMS
//   url           string — Specific launch URL for this assessment (optional; defaults to /tool)
//   assessmentId  string — Internal assessment ID stored in custom params
//   rubricId      string — Internal rubric ID stored in custom params
//   scoreMaximum  number — Tells the LMS to create a grade column with this max score
//   description   string — Optional description
router.post('/deep-link/response', async (req, res) => {
  const token = res.locals.token

  const {
    title,
    url,
    assessmentId,
    rubricId,
    scoreMaximum = 100,
    description,
  } = req.body ?? {}

  if (!title || !assessmentId) {
    return res.status(400).json({ error: 'INVALID_BODY', message: 'title and assessmentId are required.' })
  }

  const toolBase = process.env.TOOL_BASE_URL ?? 'http://localhost:3000'
  const launchUrl = url ?? `${toolBase}/lti/launch`

  const contentItem = {
    type: 'ltiResourceLink',
    title,
    url: launchUrl,
    text: description ?? undefined,
    custom: {
      assessment_id: assessmentId,
      rubric_id: rubricId ?? 'default-rubric',
    },
    // Instructs the LMS to automatically create a grade column
    lineItem: {
      scoreMaximum: Number(scoreMaximum),
      label: title,
      tag: 'grade',
    },
  }

  try {
    // createDeepLinkingMessage returns an HTML page with an auto-submitting form
    const formHtml = await lti.DeepLinking.createDeepLinkingMessage(token, [contentItem], {
      message: `Assessment "${title}" linked successfully.`,
      errmsg: 'Failed to link assessment.',
    })
    res.send(formHtml)
  } catch (err) {
    console.error('[DeepLink] createDeepLinkingMessage failed:', err.message)
    res.status(500).json({ error: 'DEEP_LINK_FAILED', message: err.message })
  }
})

module.exports = { ltiRouter: router }
