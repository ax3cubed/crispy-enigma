import type Database from 'better-sqlite3'
import type { Pool } from 'pg'

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rubrics (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS rubric_criteria (
      id          TEXT PRIMARY KEY,
      rubric_id   TEXT NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
      label       TEXT NOT NULL,
      description TEXT,
      max_points  REAL NOT NULL DEFAULT 5,
      weight      REAL NOT NULL DEFAULT 1,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id               TEXT PRIMARY KEY,
      title            TEXT NOT NULL,
      description      TEXT,
      resource_link_id TEXT,
      rubric_id        TEXT REFERENCES rubrics(id),
      created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS scores (
      id              TEXT PRIMARY KEY,
      assessment_id   TEXT REFERENCES assessments(id),
      user_id         TEXT NOT NULL,
      score_given     REAL NOT NULL,
      score_max       REAL NOT NULL,
      comment         TEXT,
      criteria_json   TEXT,
      ags_response    TEXT,
      submitted_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );
  `)

  seedDefaultRubricSqlite(db)
}

function seedDefaultRubricSqlite(db: Database.Database): void {
  const existing = db.prepare('SELECT id FROM rubrics WHERE id = ?').get('default-rubric')
  if (existing) return

  db.prepare(`INSERT INTO rubrics (id, name, description) VALUES (?, ?, ?)`).run(
    'default-rubric',
    'Standard Essay Rubric',
    'A 4-criterion rubric for evaluating written assessments. Each criterion is scored 1–5.'
  )

  const criteria = [
    { id: 'crit-1', label: 'Content Quality',    description: 'Accuracy, depth, and relevance of content.',             max_points: 5, weight: 1.5, sort_order: 0 },
    { id: 'crit-2', label: 'Critical Analysis',  description: 'Strength of argument and analytical reasoning.',          max_points: 5, weight: 1.5, sort_order: 1 },
    { id: 'crit-3', label: 'Evidence & Sources', description: 'Quality and integration of supporting evidence.',          max_points: 5, weight: 1.0, sort_order: 2 },
    { id: 'crit-4', label: 'Presentation',       description: 'Clarity, structure, grammar, and academic writing style.', max_points: 5, weight: 1.0, sort_order: 3 },
  ]

  const insert = db.prepare(
    `INSERT INTO rubric_criteria (id, rubric_id, label, description, max_points, weight, sort_order)
     VALUES (?, 'default-rubric', ?, ?, ?, ?, ?)`
  )

  for (const c of criteria) {
    insert.run(c.id, c.label, c.description, c.max_points, c.weight, c.sort_order)
  }
}

export async function runPgMigrations(pool: Pool): Promise<void> {
  // Create tables with Postgres-compatible types
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rubrics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT
    );
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rubric_criteria (
      id TEXT PRIMARY KEY,
      rubric_id TEXT NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      description TEXT,
      max_points NUMERIC NOT NULL DEFAULT 5,
      weight NUMERIC NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      resource_link_id TEXT,
      rubric_id TEXT REFERENCES rubrics(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      assessment_id TEXT REFERENCES assessments(id),
      user_id TEXT NOT NULL,
      score_given NUMERIC NOT NULL,
      score_max NUMERIC NOT NULL,
      comment TEXT,
      criteria_json JSONB,
      ags_response JSONB,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)

  await seedDefaultRubricPg(pool)
}

async function seedDefaultRubricPg(pool: Pool): Promise<void> {
  const res = await pool.query('SELECT id FROM rubrics WHERE id = $1', ['default-rubric'])
  if (res.rows.length) return

  await pool.query('INSERT INTO rubrics (id, name, description) VALUES ($1, $2, $3)', [
    'default-rubric',
    'Standard Essay Rubric',
    'A 4-criterion rubric for evaluating written assessments. Each criterion is scored 1–5.',
  ])

  const criteria = [
    { id: 'crit-1', label: 'Content Quality',    description: 'Accuracy, depth, and relevance of content.',             max_points: 5, weight: 1.5, sort_order: 0 },
    { id: 'crit-2', label: 'Critical Analysis',  description: 'Strength of argument and analytical reasoning.',          max_points: 5, weight: 1.5, sort_order: 1 },
    { id: 'crit-3', label: 'Evidence & Sources', description: 'Quality and integration of supporting evidence.',          max_points: 5, weight: 1.0, sort_order: 2 },
    { id: 'crit-4', label: 'Presentation',       description: 'Clarity, structure, grammar, and academic writing style.', max_points: 5, weight: 1.0, sort_order: 3 },
  ]

  for (const c of criteria) {
    await pool.query(
      'INSERT INTO rubric_criteria (id, rubric_id, label, description, max_points, weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [c.id, 'default-rubric', c.label, c.description, c.max_points, c.weight, c.sort_order]
    )
  }
}
