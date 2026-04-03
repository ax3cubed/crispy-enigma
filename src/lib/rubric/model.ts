// ─── Rubric data model ────────────────────────────────────────────────────────
//
// Rubric criteria define assessment dimensions (e.g. "Content Quality").
// Rubric scores are the per-criterion results from a single grading event.
// ScoringResult is the final output fed into AGS for grade passback.
//
// IMPORTANT: QTI (Question and Test Interoperability) may define and package rubric
// criteria and assessment structure, but it does NOT submit grades to the LMS.
// Grade passback is exclusively handled by AGS (Assignment and Grade Services).
// The ScoringResult below is what gets submitted via AGS — it is AGS-native.

export interface RubricCriterion {
  id: string
  rubricId: string
  label: string
  description?: string
  /** Maximum points for this criterion (e.g. 5) */
  maxPoints: number
  /** Relative weight applied before summing. Default 1.0 */
  weight: number
  sortOrder: number
}

export interface Rubric {
  id: string
  name: string
  description?: string
  criteria: RubricCriterion[]
}

export interface CriterionScore {
  criterionId: string
  /** Raw points awarded (0 – maxPoints) */
  pointsAwarded: number
  /** Optional per-criterion feedback text */
  feedback?: string
}

export interface ScoringResult {
  rubricId: string
  rubricName: string
  /** Per-criterion results */
  criteria: Array<CriterionScore & { label: string; maxPoints: number; weight: number }>
  /** Weighted sum of points awarded */
  scoreGiven: number
  /** Weighted sum of maximum points */
  scoreMaximum: number
  /** scoreGiven / scoreMaximum expressed as a percentage (0–100) */
  percentageScore: number
  /**
   * Human-readable rubric breakdown for the AGS `comment` field.
   * This is the only way rubric detail surfaces in the LMS gradebook via standard LTI.
   *
   * Example: "Content Quality: 4/5 | Critical Analysis: 3/5 | Evidence: 5/5 | Presentation: 3/5 | Total: 75.0%"
   */
  comment: string
}

// ─── AGS Score payload (subset that maps to the IMS LTI-AGS 2.0 spec) ─────────
// https://www.imsglobal.org/spec/lti-ags/v2p0/#score-publish-service
export interface AgsScorePayload {
  userId: string
  scoreGiven: number
  scoreMaximum: number
  /** ISO 8601 timestamp */
  timestamp: string
  activityProgress: 'Initialized' | 'Started' | 'InProgress' | 'Submitted' | 'Completed'
  gradingProgress: 'FullyGraded' | 'Pending' | 'PendingManual' | 'Failed' | 'NotReady'
  /** Rubric breakdown summary. Plain text only — no HTML. */
  comment?: string
}
