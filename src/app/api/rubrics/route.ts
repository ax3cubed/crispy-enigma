import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'

export async function GET() {
  const db = getDb()
  const rubrics = db.prepare('SELECT * FROM rubrics ORDER BY name').all()

  const withCriteria = rubrics.map((r: Record<string, unknown>) => ({
    ...r,
    criteria: db.prepare(
      'SELECT * FROM rubric_criteria WHERE rubric_id = ? ORDER BY sort_order'
    ).all(r.id as string),
  }))

  return NextResponse.json({ rubrics: withCriteria })
}
