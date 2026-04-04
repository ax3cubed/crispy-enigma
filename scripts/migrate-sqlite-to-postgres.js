#!/usr/bin/env node
'use strict'

// Simple migration helper: copies data from a local better-sqlite3 file into Postgres.
// Usage: APP_DATABASE_URL=<pg-url> node scripts/migrate-sqlite-to-postgres.js path/to/app.db

const path = require('path')
const Database = require('better-sqlite3')
const { Pool } = require('pg')

const sqlitePath = process.argv[2] || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'app.db')
const databaseUrl = process.env.APP_DATABASE_URL || process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('ERROR: set APP_DATABASE_URL or DATABASE_URL to target Postgres database')
  process.exit(1)
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
})

function parseJsonSafe(val) {
  if (val == null) return null
  try {
    return JSON.parse(val)
  } catch (_) {
    return null
  }
}

async function main() {
  console.log('Opening', sqlitePath)
  const sdb = new Database(sqlitePath, { readonly: true })
  const client = await pool.connect()
  try {
    console.log('Creating tables (if missing)')
    await client.query(`
      CREATE TABLE IF NOT EXISTS rubrics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT
      );
    `)

    await client.query(`
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        resource_link_id TEXT,
        rubric_id TEXT REFERENCES rubrics(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    await client.query(`
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

    console.log('Beginning transaction')
    await client.query('BEGIN')

    // rubrics
    const rubrics = sdb.prepare('SELECT * FROM rubrics').all()
    console.log('Found', rubrics.length, 'rubrics')
    for (const r of rubrics) {
      await client.query(
        `INSERT INTO rubrics (id, name, description) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
        [r.id, r.name, r.description]
      )
    }

    // rubric_criteria
    const criteria = sdb.prepare('SELECT * FROM rubric_criteria').all()
    console.log('Found', criteria.length, 'criteria')
    for (const c of criteria) {
      await client.query(
        `INSERT INTO rubric_criteria (id, rubric_id, label, description, max_points, weight, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, max_points = EXCLUDED.max_points, weight = EXCLUDED.weight, sort_order = EXCLUDED.sort_order`,
        [c.id, c.rubric_id, c.label, c.description, c.max_points, c.weight, c.sort_order]
      )
    }

    // assessments
    const assessments = sdb.prepare('SELECT * FROM assessments').all()
    console.log('Found', assessments.length, 'assessments')
    for (const a of assessments) {
      // preserve created_at if present
      const createdAt = a.created_at ? new Date(a.created_at).toISOString() : null
      await client.query(
        `INSERT INTO assessments (id, title, description, resource_link_id, rubric_id, created_at)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()))
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, resource_link_id = EXCLUDED.resource_link_id, rubric_id = EXCLUDED.rubric_id`,
        [a.id, a.title, a.description, a.resource_link_id, a.rubric_id, createdAt]
      )
    }

    // scores
    const scores = sdb.prepare('SELECT * FROM scores').all()
    console.log('Found', scores.length, 'scores')
    for (const s of scores) {
      const criteriaJson = parseJsonSafe(s.criteria_json)
      const agsResponse = parseJsonSafe(s.ags_response)
      const submittedAt = s.submitted_at ? new Date(s.submitted_at).toISOString() : null
      await client.query(
        `INSERT INTO scores (id, assessment_id, user_id, score_given, score_max, comment, criteria_json, ags_response, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, now()))
         ON CONFLICT (id) DO UPDATE SET assessment_id = EXCLUDED.assessment_id, user_id = EXCLUDED.user_id, score_given = EXCLUDED.score_given, score_max = EXCLUDED.score_max, comment = EXCLUDED.comment, criteria_json = EXCLUDED.criteria_json, ags_response = EXCLUDED.ags_response, submitted_at = EXCLUDED.submitted_at`,
        [s.id, s.assessment_id, s.user_id, s.score_given, s.score_max, s.comment, criteriaJson, agsResponse, submittedAt]
      )
    }

    await client.query('COMMIT')
    console.log('Migration completed successfully')
  } catch (err) {
    console.error('Migration failed:', err)
    try {
      await client.query('ROLLBACK')
    } catch (_) {}
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
    sdb.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
