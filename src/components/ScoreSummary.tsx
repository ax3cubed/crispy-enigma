'use client'

interface ScoreResult {
  scoreGiven: number
  scoreMaximum: number
  comment: string
  percentageScore: number
  rubricName?: string
  criteria?: Array<{
    label: string
    pointsAwarded: number
    maxPoints: number
    weight: number
    feedback?: string
  }>
}

interface Props {
  result: ScoreResult
}

function getScoreColour(pct: number): string {
  if (pct >= 80) return 'var(--success)'
  if (pct >= 60) return 'var(--warning)'
  return 'var(--danger)'
}

export default function ScoreSummary({ result }: Props) {
  const colour = getScoreColour(result.percentageScore)

  return (
    <div className="card">
      <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
        Your score has been submitted to the LMS gradebook via{' '}
        <strong>AGS (Assignment and Grade Services)</strong>.
      </div>

      <h2 style={{ marginBottom: '.25rem' }}>Score Result</h2>
      {result.rubricName && (
        <p style={{ color: 'var(--text-muted)', fontSize: '.85rem', marginTop: 0 }}>
          Rubric: {result.rubricName}
        </p>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          margin: '1rem 0 1.25rem',
        }}
      >
        <div
          style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            color: colour,
            lineHeight: 1,
          }}
        >
          {result.percentageScore.toFixed(1)}%
        </div>
        <div style={{ flex: 1 }}>
          <div className="score-bar-wrap">
            <div
              className="score-bar"
              style={{ width: `${result.percentageScore}%`, background: colour }}
            />
          </div>
          <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '.3rem' }}>
            {result.scoreGiven} / {result.scoreMaximum} weighted points
          </div>
        </div>
      </div>

      {result.criteria && result.criteria.length > 0 && (
        <>
          <h3 style={{ marginBottom: '.5rem' }}>Criteria Breakdown</h3>
          <table style={{ marginBottom: '1rem' }}>
            <thead>
              <tr>
                <th>Criterion</th>
                <th>Score</th>
                <th>Weight</th>
                <th>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {result.criteria.map((c) => (
                <tr key={c.label}>
                  <td>{c.label}</td>
                  <td>
                    {c.pointsAwarded}/{c.maxPoints}
                    <div className="score-bar-wrap" style={{ marginTop: '.2rem', height: '6px' }}>
                      <div
                        className="score-bar"
                        style={{
                          width: `${(c.pointsAwarded / c.maxPoints) * 100}%`,
                          background: getScoreColour((c.pointsAwarded / c.maxPoints) * 100),
                        }}
                      />
                    </div>
                  </td>
                  <td>
                    <span className="chip">×{c.weight}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>
                    {c.feedback ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '.75rem 1rem' }}>
        <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.25rem', fontWeight: 600 }}>
          AGS score comment (visible in LMS gradebook)
        </div>
        <code style={{ fontSize: '.8rem', wordBreak: 'break-word' }}>{result.comment}</code>
      </div>

      <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '1rem', marginBottom: 0 }}>
        <strong>Note:</strong> The rubric breakdown above is submitted as plain text in the AGS{' '}
        <code>comment</code> field — this is the only standard way to surface rubric detail in the
        LMS gradebook via LTI. QTI may define the rubric criteria structure, but grade passback is
        handled exclusively by AGS.
      </p>
    </div>
  )
}
