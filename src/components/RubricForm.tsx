'use client'

import { useState } from 'react'

interface Criterion {
  id: string
  label: string
  description?: string
  maxPoints: number
  weight: number
}

interface Rubric {
  id: string
  name: string
  description?: string
  criteria: Criterion[]
}

interface Props {
  rubric: Rubric
  onSubmit: (scores: Record<string, number>, feedbacks: Record<string, string>) => void
  submitting: boolean
  disabled: boolean
}

export default function RubricForm({ rubric, onSubmit, submitting, disabled }: Props) {
  const [scores, setScores] = useState<Record<string, number>>({})
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({})

  const allScored = rubric.criteria.every((c) => scores[c.id] != null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(scores, feedbacks)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="card">
        <h2>{rubric.name}</h2>
        {rubric.description && (
          <p style={{ color: 'var(--text-muted)', fontSize: '.9rem', marginBottom: '1rem' }}>
            {rubric.description}
          </p>
        )}

        {rubric.criteria.map((criterion) => {
          const score = scores[criterion.id]
          const pct = score != null ? (score / criterion.maxPoints) * 100 : 0

          return (
            <div
              key={criterion.id}
              style={{
                borderBottom: '1px solid var(--border)',
                paddingBottom: '1.25rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '.3rem' }}>
                <label style={{ fontWeight: 600, fontSize: '.95rem', marginBottom: 0 }}>
                  {criterion.label}
                  {criterion.weight !== 1 && (
                    <span className="chip" style={{ marginLeft: '.5rem' }}>
                      ×{criterion.weight}
                    </span>
                  )}
                </label>
                <span style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>
                  {score != null ? `${score} / ${criterion.maxPoints}` : `— / ${criterion.maxPoints}`}
                </span>
              </div>

              {criterion.description && (
                <p style={{ color: 'var(--text-muted)', fontSize: '.85rem', margin: '0 0 .5rem' }}>
                  {criterion.description}
                </p>
              )}

              {/* Point selector: 0 to maxPoints */}
              <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '.5rem' }}>
                {Array.from({ length: criterion.maxPoints + 1 }, (_, i) => i).map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    disabled={disabled}
                    onClick={() => setScores((prev) => ({ ...prev, [criterion.id]: pt }))}
                    style={{
                      width: '36px',
                      height: '36px',
                      border: `2px solid ${score === pt ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius)',
                      background: score === pt ? 'var(--primary)' : 'var(--surface)',
                      color: score === pt ? '#fff' : 'var(--text)',
                      fontWeight: score === pt ? 700 : 400,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      fontSize: '.9rem',
                    }}
                  >
                    {pt}
                  </button>
                ))}
              </div>

              {score != null && (
                <div className="score-bar-wrap" style={{ marginBottom: '.5rem' }}>
                  <div className="score-bar" style={{ width: `${pct}%` }} />
                </div>
              )}

              <div>
                <label htmlFor={`fb-${criterion.id}`} style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '.8rem' }}>
                  Feedback (optional)
                </label>
                <textarea
                  id={`fb-${criterion.id}`}
                  rows={2}
                  disabled={disabled}
                  value={feedbacks[criterion.id] ?? ''}
                  onChange={(e) => setFeedbacks((prev) => ({ ...prev, [criterion.id]: e.target.value }))}
                  placeholder="Optional feedback for this criterion…"
                  style={{ fontSize: '.85rem', marginTop: '.2rem' }}
                />
              </div>
            </div>
          )
        })}

        {!allScored && (
          <p style={{ color: 'var(--text-muted)', fontSize: '.85rem', marginBottom: '.75rem' }}>
            Score all criteria to submit.
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!allScored || submitting || disabled}
        >
          {submitting ? 'Submitting score…' : 'Submit Assessment Score'}
        </button>
      </div>
    </form>
  )
}
