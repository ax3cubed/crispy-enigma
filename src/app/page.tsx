export default function HomePage() {
  return (
    <div className="container">
      <h1>LTI 1.3 Assessment Tool</h1>
      <p style={{ color: 'var(--text-muted)' }}>
        This tool provides rubric-driven assessment with LTI Advantage grade passback via AGS.
      </p>

      <div className="card">
        <h2>saLTIre Registration Values</h2>
        <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Register this tool as a new Tool Provider in{' '}
          <a href="https://saltire.lti.app/" target="_blank" rel="noreferrer">saLTIre</a>{' '}
          using the values below. After registering, paste the platform credentials into{' '}
          <code>.env.local</code> and restart the server.
        </p>
        <table>
          <tbody>
            {[
              ['OIDC Login URL', '/lti/login'],
              ['Launch / Redirect URL', '/lti/launch'],
              ['Deep Linking URL', '/lti/launch'],
              ['JWKS URL', '/lti/keys'],
              ['Target Link URI', '/lti/launch'],
            ].map(([label, path]) => (
              <tr key={label}>
                <th style={{ width: '200px' }}>{label}</th>
                <td>
                  <code>{'<TOOL_BASE_URL>'}{path}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>LTI Services</h2>
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Standard</th>
              <th>What it provides</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Authentication', 'LTI 1.3 Core (OIDC)', 'OIDC login initiation + JWT id_token validation'],
              ['Grade passback', 'AGS 2.0', 'POST scores to the LMS gradebook via line items'],
              ['Roster access', 'NRPS 2.0', 'Read course membership, names, roles'],
              ['Assessment linking', 'Deep Linking 2.0', 'Instructor selects/configures assessment from LMS'],
            ].map(([svc, std, desc]) => (
              <tr key={svc}>
                <td><strong>{svc}</strong></td>
                <td><code style={{ fontSize: '.8rem' }}>{std}</code></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>QTI vs AGS</h2>
        <div className="alert alert-info" style={{ marginBottom: 0 }}>
          <strong>Important:</strong> QTI (Question and Test Interoperability) defines assessment and
          rubric <em>structure</em> — it is used for packaging and importing assessment content.
          It does <strong>not</strong> submit grades to the LMS gradebook.
          Grade passback is performed exclusively via <strong>AGS (Assignment and Grade Services)</strong>.
          Rubric breakdown detail is surfaced in the LMS via the AGS score&apos;s{' '}
          <code>comment</code> field.
        </div>
      </div>

      <div className="card">
        <h2>Quick Start</h2>
        <ol style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '.9rem' }}>
          <li>Copy <code>.env.example</code> to <code>.env.local</code></li>
          <li>Run <code>npm install</code> then <code>npm run dev</code></li>
          <li>Register the tool in saLTIre using the values above</li>
          <li>Paste the saLTIre platform credentials into <code>.env.local</code> and restart</li>
          <li>Trigger an instructor launch from saLTIre → you will land on <code>/instructor</code></li>
          <li>Trigger a learner launch → you will land on <code>/tool</code></li>
        </ol>
      </div>
    </div>
  )
}
