import type { Rubric, CriterionScore, ScoringResult, AgsScorePayload } from './model'

/**
 * Computes a ScoringResult from a rubric definition and a set of criterion scores.
 *
 * Scoring formula:
 *   weightedPoints = sum(criterion.weight * score.pointsAwarded)
 *   weightedMax    = sum(criterion.weight * criterion.maxPoints)
 *   percentage     = (weightedPoints / weightedMax) * 100
 *
 * The result is AGS-ready: scoreGiven and scoreMaximum can be posted directly
 * to the AGS scores endpoint. The comment field contains the rubric breakdown
 * in plain text — this is the only standard way to surface rubric detail in the
 * LMS gradebook via LTI AGS.
 *
 * NOTE: QTI may define the rubric criteria structure (e.g. imported as a QTI
 * assessment package), but QTI itself does NOT submit scores to the LMS.
 * Only AGS does that. This function bridges the two: it interprets rubric
 * criteria (which could originate from QTI) and produces an AGS-compatible payload.
 */
export function computeScore(rubric: Rubric, criterionScores: CriterionScore[]): ScoringResult {
  const scoreMap = new Map(criterionScores.map((s) => [s.criterionId, s]))

  let weightedPoints = 0
  let weightedMax = 0
  const detailedCriteria: ScoringResult['criteria'] = []
  const parts: string[] = []

  for (const criterion of rubric.criteria) {
    const score = scoreMap.get(criterion.id)
    const awarded = score?.pointsAwarded ?? 0
    const clamped = Math.max(0, Math.min(awarded, criterion.maxPoints))

    weightedPoints += criterion.weight * clamped
    weightedMax += criterion.weight * criterion.maxPoints

    detailedCriteria.push({
      criterionId: criterion.id,
      label: criterion.label,
      maxPoints: criterion.maxPoints,
      weight: criterion.weight,
      pointsAwarded: clamped,
      feedback: score?.feedback,
    })

    parts.push(`${criterion.label}: ${clamped}/${criterion.maxPoints}`)
  }

  const percentage = weightedMax > 0 ? (weightedPoints / weightedMax) * 100 : 0
  const comment = `${parts.join(' | ')} | Total: ${percentage.toFixed(1)}%`

  return {
    rubricId: rubric.id,
    rubricName: rubric.name,
    criteria: detailedCriteria,
    scoreGiven: Math.round(weightedPoints * 100) / 100,
    scoreMaximum: Math.round(weightedMax * 100) / 100,
    percentageScore: Math.round(percentage * 10) / 10,
    comment,
  }
}

/**
 * Converts a ScoringResult into an AGS-compliant score payload ready for
 * POST to {lineitem_url}/scores.
 *
 * Content-Type for this payload: application/vnd.ims.lis.v1.score+json
 */
export function toAgsPayload(result: ScoringResult, userId: string): AgsScorePayload {
  return {
    userId,
    scoreGiven: result.scoreGiven,
    scoreMaximum: result.scoreMaximum,
    timestamp: new Date().toISOString(),
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded',
    comment: result.comment,
  }
}

/**
 * Validates that all criteria in the rubric have a corresponding score entry.
 * Returns an array of criterion IDs that are missing scores.
 */
export function getMissingCriteria(rubric: Rubric, criterionScores: CriterionScore[]): string[] {
  const scored = new Set(criterionScores.map((s) => s.criterionId))
  return rubric.criteria.filter((c) => !scored.has(c.id)).map((c) => c.id)
}
