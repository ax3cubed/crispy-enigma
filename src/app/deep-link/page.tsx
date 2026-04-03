'use client'

import { useEffect, useState } from 'react'

interface LtiContext {
  user: { id: string; name: string | null }
  roles: string[]
  isInstructor: boolean
  context: { id: string; label: string; title: string } | null
  messageType: string | null
}

interface Rubric {
  id: string
  name: string
  description?: string
}

export default function DeepLinkPage() {
  const [ctx, setCtx] = useState<LtiContext | null>(null)
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    assessmentId: '',
    rubricId: 'default-rubric',
    scoreMaximum: '100',
  })

  useEffect(() => {
    fetch('/api/lti/context', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.message ?? data.error)
        if (!data.isInstructor) throw new Error('Access denied: instructor role required for Deep Linking.')
        setCtx(data)
        return fetch('/api/rubrics')
      })
      .then((r) => r.json())
      .then((data) => setRubrics(data.rubrics ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    // Auto-generate an assessmentId from the title if not provided
    const assessmentId = form.assessmentId.trim() || form.title.toLowerCase().replace(/\s+/g, '-')

    try {
      // Build and sign the Deep Linking response JWT via the ltijs-protected Express route.
      // The response is an HTML page with an auto-submitting form that POSTs the signed JWT
      // back to the platform's deep_link_return_url.
      const res = await fetch('/api/lti/deep-link/response', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          assessmentId,
          rubricId: form.rubricId,
          scoreMaximum: Number(form.scoreMaximum),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Deep Linking response failed')
      }

      // ltijs returns an HTML page with the auto-submit form.
      // Replace the current document with it so the form auto-submits to the LMS.
      const html = await res.text()
      document.open()
      document.write(html)
      document.close()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  if (error && !ctx) {
    return (
      <div className="container">
        <div className="alert alert-error">
          <strong>Deep Linking Error:</strong> {error}
          <br />
          <small>This page must be launched via an LtiDeepLinkingRequest from the LMS.</small>
        </div>
      </div>
    )
  }

  if (!ctx) {
    return (
      <div className="container">
        <p style={{ color: 'var(--text-muted)' }}>Loading Deep Linking configuration...</p>
      </div>
    )
  }

  return (
    <div className="container">
      <nav className="nav" style={{ marginBottom: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <span className="nav-brand">LTI Assessment Tool</span>
        <span className="nav-spacer" />
        <span className="chip">{ctx.context?.label ?? 'Unknown Course'}</span>
        <span className="badge badge-instructor">Deep Linking</span>
      </nav>

      <h1>Configure Assessment</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
        Select or create an assessment to link into the LMS course. When you click{' '}
        <strong>Link Assessment</strong>, a signed Deep Linking response will be returned to the
        platform, creating a resource link and grade column.
      </p>

      <div className="alert alert-info">
        <strong>Deep Linking 2.0:</strong> This is the standard-compliant mechanism for an instructor
        to configure an assessment from within the LMS. The tool returns an{' '}
        <code>LtiDeepLinkingResponse</code> JWT containing an <code>ltiResourceLink</code> content item.
        The platform stores this link and will send an <code>LtiResourceLinkRequest</code> to the same
        URL on subsequent launches. Specifying a <code>lineItem</code> in the content item asks the
        LMS to create a grade column automatically.
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label htmlFor="title">Assessment Title *</label>
            <input
              id="title"
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Module 3 Research Essay"
              required
            />
          </div>

          <div className="form-row">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              rows={2}
              value={form.description}
              onChange={handleChange}
              placeholder="Optional description shown to learners"
            />
          </div>

          <div className="form-row">
            <label htmlFor="assessmentId">Assessment ID</label>
            <input
              id="assessmentId"
              name="assessmentId"
              type="text"
              value={form.assessmentId}
              onChange={handleChange}
              placeholder="Auto-generated from title if left blank"
            />
            <small style={{ color: 'var(--text-muted)' }}>
              Stored as a custom LTI parameter. Passed back on every learner launch so the tool
              knows which assessment to display.
            </small>
          </div>

          <div className="form-row">
            <label htmlFor="rubricId">Rubric</label>
            <select id="rubricId" name="rubricId" value={form.rubricId} onChange={handleChange}>
              {rubrics.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="scoreMaximum">Maximum Score (AGS)</label>
            <input
              id="scoreMaximum"
              name="scoreMaximum"
              type="number"
              min={1}
              max={1000}
              value={form.scoreMaximum}
              onChange={handleChange}
              style={{ maxWidth: '120px' }}
            />
            <small style={{ color: 'var(--text-muted)' }}>
              The <code>lineItem.scoreMaximum</code> sent to the LMS for the grade column.
            </small>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !form.title}
          >
            {submitting ? 'Linking…' : 'Link Assessment to LMS'}
          </button>
        </form>
      </div>
    </div>
  )
}
