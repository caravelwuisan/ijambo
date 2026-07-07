import { supabase } from './supabase'
import type { Question, QuestionRule, Test } from './types'

/** Charge les questions d'un test : liste explicite (question_ids) ou règles (§6.3). */
export async function resolveTestQuestions(test: Pick<Test, 'question_ids' | 'question_rules'>, seed?: string): Promise<Question[]> {
  if (test.question_ids?.length) {
    const { data } = await supabase
      .from('questions')
      .select('*, passage:passages(*)')
      .in('id', test.question_ids)
    const byId = new Map((data ?? []).map((q) => [q.id, q as unknown as Question]))
    return test.question_ids.map((id) => byId.get(id)).filter(Boolean) as Question[]
  }
  if (test.question_rules?.length) {
    const out: Question[] = []
    for (const rule of test.question_rules) {
      out.push(...(await resolveRule(rule, seed)))
    }
    return out
  }
  return []
}

export async function resolveRule(rule: QuestionRule, seed?: string): Promise<Question[]> {
  let q = supabase.from('questions').select('*, passage:passages(*)').eq('status', 'published')
  if (rule.section) q = q.eq('section', rule.section)
  if (rule.tags?.length) q = q.overlaps('tags', rule.tags)
  if (rule.difficulty) q = q.gte('difficulty', rule.difficulty[0]).lte('difficulty', rule.difficulty[1])
  const { data } = await q
  const pool = (data ?? []) as unknown as Question[]
  return shuffle(pool, seed).slice(0, rule.count)
}

/** Mélange déterministe si un seed est fourni (reprise d'un test interrompu). */
function shuffle<T>(arr: T[], seed?: string): T[] {
  const a = [...arr]
  let rand: () => number
  if (seed) {
    let h = 2166136261
    for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
    rand = () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507)
      h = Math.imul(h ^ (h >>> 13), 3266489909)
      return ((h ^= h >>> 16) >>> 0) / 4294967296
    }
  } else {
    rand = Math.random
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Tri : regroupe par passage pour que les questions d'un même texte se suivent. */
export function groupByPassage(questions: Question[]): Question[] {
  const seen = new Map<string, Question[]>()
  const order: string[] = []
  for (const q of questions) {
    const key = q.passage_id ?? `solo-${q.id}`
    if (!seen.has(key)) {
      seen.set(key, [])
      order.push(key)
    }
    seen.get(key)!.push(q)
  }
  return order.flatMap((k) => seen.get(k)!)
}
