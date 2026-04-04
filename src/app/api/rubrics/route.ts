import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'

export async function GET() {
  const db = await getDb()
  const rubrics = (await db.prepare('SELECT * FROM rubrics ORDER BY name').all()) as Record<string, unknown>[]

  const withCriteria = await Promise.all(
    rubrics.map(async (r) => ({
      ...r,
      criteria: await db
        .prepare('SELECT * FROM rubric_criteria WHERE rubric_id = ? ORDER BY sort_order')
        .all(r.id as string),
    }))
  )

  return NextResponse.json({ rubrics: withCriteria })
}
