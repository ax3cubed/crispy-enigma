'use client'

import { useEffect, useState } from 'react'
import RosterTable from '@/components/RosterTable'

interface LtiContext {
  user: { id: string; name: string | null }
  roles: string[]
  isInstructor: boolean
  context: { id: string; label: string; title: string } | null
  resourceLink: { id: string; title?: string } | null
  agsEndpoint: { lineitem?: string; lineitems?: string } | null
  nrpsEndpoint: { context_memberships_url?: string } | null
}

interface LineItem {
  id: string
  label: string
  scoreMaximum: number
  resourceLinkId?: string
  tag?: string
}

interface Member {
  user_id: string
  name?: string
  email?: string
  roles: string[]
  status: string
}

export default function InstructorPage() {
  const [ctx, setCtx] = useState<LtiContext | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'roster' | 'grades'>('overview')

  useEffect(() => {
    fetch('/api/lti/context', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.message ?? data.error)
        if (!data.isInstructor) {
          throw new Error('Access denied: instructor role required.')
        }
        setCtx(data)

        if (data.agsEndpoint) {
          return fetch('/api/lti/lineitems', { credentials: 'include' })
            .then((r) => r.json())
            .then((li) => setLineItems(li.lineItems ?? []))
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const loadRoster = async () => {
    setLoadingRoster(true)
    try {
      const res = await fetch('/api/lti/roster', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? data.error)
      setMembers(data.members ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingRoster(false)
    }
  }

  if (error && !ctx) {
    return (
      <div className="container">
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      </div>
    )
  }

  if (!ctx) {
    return (
      <div className="container">
        <p style={{ color: 'var(--text-muted)' }}>Loading instructor view...</p>
      </div>
    )
  }

  return (
    <div className="container">
      <nav className="nav" style={{ marginBottom: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <span className="nav-brand">LTI Assessment Tool</span>
        <span className="nav-spacer" />
        <span className="chip">{ctx.context?.label ?? 'Unknown Course'}</span>
        <span className="badge badge-instructor">Instructor</span>
      </nav>

      <h1>Instructor Dashboard</h1>
      {ctx.context?.title && (
        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>{ctx.context.title}</p>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '.5rem' }}>
        {(['overview', 'roster', 'grades'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t)
              if (t === 'roster' && members.length === 0) loadRoster()
            }}
            style={{
              background: tab === t ? 'var(--primary)' : 'var(--surface)',
              color: tab === t ? '#fff' : 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '.4rem .9rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '.85rem',
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="card">
            <h2>LTI Context</h2>
            <table>
              <tbody>
                <tr><th>User ID</th><td><code>{ctx.user.id}</code></td></tr>
                <tr><th>Name</th><td>{ctx.user.name ?? '—'}</td></tr>
                <tr><th>Course ID</th><td><code>{ctx.context?.id ?? '—'}</code></td></tr>
                <tr><th>Course Label</th><td>{ctx.context?.label ?? '—'}</td></tr>
                <tr><th>Resource Link</th><td><code>{ctx.resourceLink?.id ?? '—'}</code></td></tr>
                <tr>
                  <th>AGS</th>
                  <td>
                    {ctx.agsEndpoint ? (
                      <span className="badge badge-success">Available</span>
                    ) : (
                      <span className="badge badge-error">Not available</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <th>NRPS</th>
                  <td>
                    {ctx.nrpsEndpoint ? (
                      <span className="badge badge-success">Available</span>
                    ) : (
                      <span className="badge badge-error">Not available</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Configure Assessment</h2>
            <p style={{ fontSize: '.9rem', color: 'var(--text-muted)' }}>
              To link this tool to an assessment from the LMS, trigger a{' '}
              <strong>Deep Linking launch</strong> from saLTIre. The tool will redirect to the
              assessment configuration page where you can select a rubric and create a grade column.
            </p>
            <div className="alert alert-info" style={{ marginBottom: 0 }}>
              <strong>Standard behaviour:</strong> Assessment linking uses{' '}
              <strong>LTI Deep Linking 2.0</strong>. Detecting an assessment configuration
              requires the LMS to send an <code>LtiDeepLinkingRequest</code> — this is the
              standard-compliant mechanism. Detecting file uploads or QTI package imports
              requires vendor-specific LMS APIs, which are outside LTI scope.
            </div>
          </div>
        </>
      )}

      {tab === 'roster' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Course Roster (NRPS)</h2>
            <button className="btn btn-secondary btn-sm" onClick={loadRoster} disabled={loadingRoster}>
              {loadingRoster ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {!ctx.nrpsEndpoint && (
            <div className="alert alert-warning">
              NRPS endpoint not present in launch token. Enable{' '}
              <strong>Names and Roles Provisioning Service</strong> in the saLTIre platform configuration.
            </div>
          )}

          {members.length === 0 && !loadingRoster && ctx.nrpsEndpoint && (
            <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>Click Refresh to load the roster.</p>
          )}

          {members.length > 0 && <RosterTable members={members} />}
        </div>
      )}

      {tab === 'grades' && (
        <div className="card">
          <h2>AGS Line Items</h2>

          {!ctx.agsEndpoint && (
            <div className="alert alert-warning">
              AGS endpoint not present in launch token. Enable{' '}
              <strong>Assignment and Grade Services</strong> in the saLTIre platform configuration.
            </div>
          )}

          {ctx.agsEndpoint && lineItems.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>
              No line items found. Line items are created when an assessment is configured via
              Deep Linking, or when the first learner submits a score.
            </p>
          )}

          {lineItems.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Max Score</th>
                  <th>Tag</th>
                  <th>Line Item URL</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.label}</td>
                    <td>{item.scoreMaximum}</td>
                    <td><span className="chip">{item.tag ?? '—'}</span></td>
                    <td style={{ fontSize: '.75rem', wordBreak: 'break-all' }}>
                      <code>{item.id}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
