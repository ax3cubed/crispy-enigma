import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const rubric = db.prepare('SELECT * FROM rubrics WHERE id = ?').get(id)

  if (!rubric) {
    return NextResponse.json({ error: 'Rubric not found' }, { status: 404 })
  }

  const criteria = db
    .prepare('SELECT * FROM rubric_criteria WHERE rubric_id = ? ORDER BY sort_order')
    .all(id)

  return NextResponse.json({ ...(rubric as object), criteria })
}
