'use client'

interface Member {
  user_id: string
  name?: string
  email?: string
  roles: string[]
  status: string
}

interface Props {
  members: Member[]
}

function formatRole(roleUri: string): string {
  // Extract the short role name from a full LIS role URI
  // e.g. http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor → Instructor
  const hash = roleUri.lastIndexOf('#')
  const slash = roleUri.lastIndexOf('/')
  return roleUri.slice(Math.max(hash, slash) + 1)
}

function isInstructor(roles: string[]): boolean {
  return roles.some((r) => r.includes('Instructor') || r.includes('TeachingAssistant'))
}

export default function RosterTable({ members }: Props) {
  const instructors = members.filter((m) => isInstructor(m.roles))
  const learners = members.filter((m) => !isInstructor(m.roles))

  return (
    <>
      <div style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginBottom: '.75rem' }}>
        {members.length} member{members.length !== 1 ? 's' : ''} total —{' '}
        {instructors.length} instructor{instructors.length !== 1 ? 's' : ''},{' '}
        {learners.length} learner{learners.length !== 1 ? 's' : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>User ID</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.user_id}>
              <td>{m.name ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
              <td style={{ fontSize: '.85rem' }}>{m.email ?? '—'}</td>
              <td>
                {m.roles.map((r) => (
                  <span
                    key={r}
                    className={`badge ${isInstructor([r]) ? 'badge-instructor' : 'badge-learner'}`}
                    style={{ marginRight: '.25rem' }}
                  >
                    {formatRole(r)}
                  </span>
                ))}
              </td>
              <td>
                <span
                  className={`badge ${m.status === 'Active' ? 'badge-success' : 'badge-error'}`}
                >
                  {m.status}
                </span>
              </td>
              <td style={{ fontSize: '.75rem' }}>
                <code>{m.user_id}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.75rem', marginBottom: 0 }}>
        Roster retrieved via <strong>NRPS 2.0</strong> (Names and Roles Provisioning Service).
        Role URIs follow the IMS LIS vocabulary:{' '}
        <code>http://purl.imsglobal.org/vocab/lis/v2/membership#</code>
      </p>
    </>
  )
}
