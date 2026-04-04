import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { computeScore } from '@/lib/rubric/scorer'
import type { Rubric, RubricCriterion, CriterionScore } from '@/lib/rubric/model'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { rubricId, criterionScores, feedbacks = {} } = body as {
    rubricId: string
    criterionScores: Record<string, number>
    feedbacks?: Record<string, string>
  }

  if (!rubricId || !criterionScores) {
    return NextResponse.json({ error: 'rubricId and criterionScores are required' }, { status: 400 })
  }

  const db = await getDb()

  const rubricRow = (await db.prepare('SELECT * FROM rubrics WHERE id = ?').get(rubricId)) as Record<string, unknown> | undefined
  if (!rubricRow) {
    return NextResponse.json({ error: 'Rubric not found' }, { status: 404 })
  }

  const criteriaRows = (await db
    .prepare('SELECT * FROM rubric_criteria WHERE rubric_id = ? ORDER BY sort_order')
    .all(rubricId)) as Array<{
    id: string
    rubric_id: string
    label: string
    description: string
    max_points: number
    weight: number
    sort_order: number
  }>

  const rubric: Rubric = {
    id: rubricRow.id as string,
    name: rubricRow.name as string,
    description: rubricRow.description as string | undefined,
    criteria: criteriaRows.map((c): RubricCriterion => ({
      id: c.id,
      rubricId: c.rubric_id,
      label: c.label,
      description: c.description,
      maxPoints: c.max_points,
      weight: c.weight,
      sortOrder: c.sort_order,
    })),
  }

  const scores: CriterionScore[] = Object.entries(criterionScores).map(([criterionId, pointsAwarded]) => ({
    criterionId,
    pointsAwarded: Number(pointsAwarded),
    feedback: feedbacks[criterionId] ?? undefined,
  }))

  const result = computeScore(rubric, scores)

  return NextResponse.json(result)
}
