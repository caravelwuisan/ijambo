import type { Question, Scoring, ScoringBand } from './types'

/** Barème par défaut (§8) — surchargé par tests.scoring en BDD. */
export const DEFAULT_SCORING: Scoring = {
  total_points: 100,
  bands: [
    { min: 0, max: 29, cefr: 'A2', toefl_range: [30, 45], program_weeks: 16 },
    { min: 30, max: 49, cefr: 'B1-', toefl_range: [46, 60], program_weeks: 12 },
    { min: 50, max: 64, cefr: 'B1+', toefl_range: [61, 75], program_weeks: 10 },
    { min: 65, max: 79, cefr: 'B2', toefl_range: [76, 90], program_weeks: 8 },
    { min: 80, max: 100, cefr: 'C1', toefl_range: [91, 110], program_weeks: 5 },
  ],
  det_recommendation_threshold: 60,
}

export function isCorrect(q: Pick<Question, 'correct' | 'type'>, answer: number[] | undefined): boolean {
  if (!answer || answer.length === 0) return false
  const correct = [...q.correct].sort()
  const given = [...answer].sort()
  if (q.type === 'ordering') return q.correct.every((c, i) => answer[i] === c)
  return correct.length === given.length && correct.every((c, i) => c === given[i])
}

export interface DiagResult {
  raw: number
  band: ScoringBand
  projected: number
  sectionScores: Record<string, number>
  recommendDET: boolean
}

/**
 * Score brut pondéré /100. Les questions d'auto-évaluation (writing/speaking en QCM)
 * n'ont pas de "bonne" réponse : l'index choisi (0..n-1) vaut une fraction du poids.
 */
export function scoreDiagnostic(
  questions: Question[],
  answers: Record<string, number[]>,
  scoring: Scoring = DEFAULT_SCORING,
): DiagResult {
  let earned = 0
  let totalWeight = 0
  const bySection: Record<string, { earned: number; total: number }> = {}

  for (const q of questions) {
    const w = Number(q.weight) || 1
    totalWeight += w
    const sec = (bySection[q.section] ??= { earned: 0, total: 0 })
    sec.total += w
    const ans = answers[q.id]
    const selfAssessed = q.correct.length === 0
    if (selfAssessed) {
      const idx = ans?.[0] ?? 0
      const map = (q as any).scoring_map as number[] | null
      const pts = map?.[idx] ?? (idx / Math.max(q.options.length - 1, 1)) * w
      earned += pts
      sec.earned += pts
    } else if (isCorrect(q, ans)) {
      earned += w
      sec.earned += w
    }
  }

  const raw = totalWeight > 0 ? Math.round((earned / totalWeight) * scoring.total_points) : 0
  const band =
    scoring.bands.find((b) => raw >= b.min && raw <= b.max) ?? scoring.bands[scoring.bands.length - 1]
  const [lo, hi] = band.toefl_range
  const span = band.max - band.min || 1
  const projected = Math.round(lo + ((raw - band.min) / span) * (hi - lo))

  const sectionScores: Record<string, number> = {}
  for (const [s, v] of Object.entries(bySection))
    sectionScores[s] = v.total ? Math.round((v.earned / v.total) * 100) : 0

  return { raw, band, projected, sectionScores, recommendDET: projected < scoring.det_recommendation_threshold }
}

/** Jalons du « chemin » : tests blancs aux tiers du programme (§8). */
export function pathMilestones(weeks: number) {
  const m1 = Math.max(1, Math.round(weeks / 3))
  const m2 = Math.max(m1 + 1, Math.round((2 * weeks) / 3))
  return { mock1: m1, mock2: m2, examDay: weeks }
}

/** Rythme intensif si la date d'examen déclarée est plus proche que la durée recommandée. */
export function intensivePace(targetDate: string | null, weeks: number, baseHours = 5) {
  if (!targetDate) return { intensive: false, hours: baseHours, weeks }
  const available = Math.floor((new Date(targetDate).getTime() - Date.now()) / (7 * 24 * 3600 * 1000))
  if (available <= 0 || available >= weeks) return { intensive: false, hours: baseHours, weeks }
  const hours = Math.min(20, Math.ceil((weeks * baseHours) / available))
  return { intensive: true, hours, weeks: available }
}

export function newPaymentReference(): string {
  // 6 caractères sans ambiguïté (pas de O/0, I/1)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = ''
  const buf = new Uint8Array(6)
  crypto.getRandomValues(buf)
  for (const b of buf) ref += alphabet[b % alphabet.length]
  return ref
}
