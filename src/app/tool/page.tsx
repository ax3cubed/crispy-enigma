'use client'

import { useEffect, useState } from 'react'
import RubricForm from '@/components/RubricForm'
import ScoreSummary from '@/components/ScoreSummary'

interface LtiContext {
  user: { id: string; name: string | null; email: string | null }
  roles: string[]
  isInstructor: boolean
  context: { id: string; label: string; title: string } | null
  resourceLink: { id: string; title?: string } | null
  customParams: Record<string, string>
  agsEndpoint: { lineitem?: string; lineitems?: string; scope?: string[] } | null
}

interface Rubric {
  id: string
  name: string
  description: string
  criteria: Array<{
    id: string
    label: string
    description: string
    maxPoints: number
    weight: number
    sortOrder: number
  }>
}

interface ScoreResult {
  scoreGiven: number
  scoreMaximum: number
  comment: string
  percentageScore: number
}

export default function ToolPage() {
  const [ctx, setCtx] = useState<LtiContext | null>(null)
  const [rubric, setRubric] = useState<Rubric | null>(null)
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    // Fetch LTI context from the ltijs-protected Express route
    fetch('/api/lti/context', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.message ?? data.error)
        setCtx(data)

        // Determine which rubric to load from custom params or fall back to default
        const rubricId = data.customParams?.rubric_id ?? 'default-rubric'
        return fetch(`/api/rubrics/${rubricId}`)
      })
      .then((r) => r.json())
      .then(setRubric)
      .catch((err) => setError(err.message))
  }, [])

  const handleSubmitScore = async (criterionScores: Record<string, number>, feedbacks: Record<string, string>) => {
    if (!ctx || !rubric) return
    setSubmitting(true)
    setError(null)

    try {
      // 1. Compute score locally using the rubric scorer
      const computeRes = await fetch('/api/rubrics/compute-score', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rubricId: rubric.id,
          criterionScores,
          feedbacks,
        }),
      })
      const computed = await computeRes.json()
      if (!computeRes.ok) throw new Error(computed.message ?? 'Score computation failed')

      setScoreResult(computed)

      // 2. Discover or create the AGS line item
      const lineItemsRes = await fetch('/api/lti/lineitems', { credentials: 'include' })
      const lineItemsData = await lineItemsRes.json()

      let lineItemId: string | null = null

      if (lineItemsData.lineItems?.length > 0) {
        // Use the first line item associated with this resource link
        lineItemId = lineItemsData.lineItems[0].id
      } else if (ctx.agsEndpoint?.lineitems) {
        // Create a line item if none exist
        const createRes = await fetch('/api/lti/lineitems', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: ctx.resourceLink?.title ?? 'Assessment',
            scoreMaximum: computed.scoreMaximum,
          }),
        })
        const created = await createRes.json()
        if (!createRes.ok) throw new Error(created.message ?? 'Failed to create line item')
        lineItemId = created.lineItem?.id
      }

      if (!lineItemId) {
        throw new Error(
          'No AGS line item available. The platform may not support grade passback, ' +
            'or the assessment was not configured with a line item.'
        )
      }

      // 3. Submit score via AGS
      const scoreRes = await fetch('/api/lti/scores', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItemId,
          scoreGiven: computed.scoreGiven,
          scoreMaximum: computed.scoreMaximum,
          comment: computed.comment,
          activityProgress: 'Completed',
          gradingProgress: 'FullyGraded',
        }),
      })
      const scoreData = await scoreRes.json()
      if (!scoreRes.ok) throw new Error(scoreData.message ?? 'AGS score submission failed')

      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  if (error && !ctx) {
    return (
      <div className="container">
        <div className="alert alert-error">
          <strong>LTI Session Error:</strong> {error}
          <br />
          <small>Ensure you launched this tool from a valid LTI 1.3 platform (e.g. saLTIre).</small>
        </div>
      </div>
    )
  }

  if (!ctx || !rubric) {
    return (
      <div className="container">
        <p style={{ color: 'var(--text-muted)' }}>Loading assessment...</p>
      </div>
    )
  }

  const assessmentTitle = ctx.customParams?.assessment_id
    ? `Assessment: ${ctx.customParams.assessment_id}`
    : ctx.resourceLink?.title ?? 'Assessment'

  return (
    <div className="container">
      <nav className="nav" style={{ marginBottom: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <span className="nav-brand">LTI Assessment Tool</span>
        <span className="nav-spacer" />
        <span className="chip">{ctx.context?.label ?? 'Unknown Course'}</span>
        <span className="badge badge-learner">Learner</span>
      </nav>

      <h1>{assessmentTitle}</h1>
      {ctx.context?.title && (
        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>{ctx.context.title}</p>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {submitted && scoreResult ? (
        <ScoreSummary result={scoreResult} />
      ) : (
        <RubricForm
          rubric={rubric}
          onSubmit={handleSubmitScore}
          submitting={submitting}
          disabled={submitted}
        />
      )}
    </div>
  )
}
