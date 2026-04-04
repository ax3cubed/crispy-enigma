import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  const db = await getDb()
  const rows = await db.prepare(`
    SELECT a.*, r.name as rubric_name
    FROM assessments a
    LEFT JOIN rubrics r ON r.id = a.rubric_id
    ORDER BY a.created_at DESC
  `).all()
  return NextResponse.json({ assessments: rows })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, description, rubricId, resourceLinkId } = body

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  const db = await getDb()
  const id = uuidv4()
  await db
    .prepare(
      `INSERT INTO assessments (id, title, description, rubric_id, resource_link_id)
    VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, title, description ?? null, rubricId ?? 'default-rubric', resourceLinkId ?? null)

  const row = await db.prepare('SELECT * FROM assessments WHERE id = ?').get(id)
  return NextResponse.json({ assessment: row }, { status: 201 })
}
