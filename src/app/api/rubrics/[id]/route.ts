import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const rubric = db.prepare('SELECT * FROM rubrics WHERE id = ?').get(params.id)

  if (!rubric) {
    return NextResponse.json({ error: 'Rubric not found' }, { status: 404 })
  }

  const criteria = db
    .prepare('SELECT * FROM rubric_criteria WHERE rubric_id = ? ORDER BY sort_order')
    .all(params.id)

  return NextResponse.json({ ...(rubric as object), criteria })
}
