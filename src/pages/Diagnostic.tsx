import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { groupByPassage, resolveTestQuestions } from '../lib/questions'
import { scoreDiagnostic, DEFAULT_SCORING } from '../lib/scoring'
import type { Attempt, Question, Scoring, Test } from '../lib/types'
import QuestionCard from '../components/QuestionCard'
import { BrandLogo, ScreenShell, Spinner } from '../components/ui'

type Phase = 'loading' | 'blocked' | 'intro' | 'running' | 'done'

export default function Diagnostic() {
  const { t, locale } = useI18n()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<Phase>('loading')
  const [test, setTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [answers, setAnswers] = useState<Record<string, number[]>>({})
  const [idx, setIdx] = useState(0)
  const [endsAt, setEndsAt] = useState<number>(0)
  const [now, setNow] = useState(Date.now())
  const finishing = useRef(false)

  // chargement : test actif + tentative existante
  useEffect(() => {
    if (!session) return
    ;(async () => {
      const { data: t } = await supabase
        .from('tests')
        .select('*')
        .eq('kind', 'diagnostic')
        .eq('is_active', true)
        .eq('status', 'published')
        .maybeSingle()
      if (!t) {
        setPhase('blocked')
        return
      }
      const active = t as unknown as Test
      setTest(active)

      // tentative non terminée → reprise
      const { data: open } = await supabase
        .from('attempts')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('kind', 'diagnostic')
        .is('finished_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (open) {
        const a = open as unknown as Attempt & { state: any }
        const qs = groupByPassage(await resolveTestQuestions(active, a.id))
        setQuestions(qs)
        setAttempt(a)
        setAnswers(a.answers ?? {})
        setIdx(Math.min(a.state?.idx ?? 0, qs.length - 1))
        setEndsAt(a.state?.ends_at ?? Date.now() + (active.duration_min ?? 25) * 60000)
        setPhase('running')
        return
      }

      const { data: can } = await supabase.rpc('can_take_diagnostic')
      setPhase(can === false ? 'blocked' : 'intro')
    })()
  }, [session])

  // timer
  useEffect(() => {
    if (phase !== 'running') return
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [phase])

  const remaining = Math.max(0, Math.floor((endsAt - now) / 1000))

  const finish = useCallback(
    async (finalAnswers: Record<string, number[]>) => {
      if (finishing.current || !attempt || !test) return
      finishing.current = true
      const scoring = (test.scoring as Scoring) ?? DEFAULT_SCORING
      const r = scoreDiagnostic(questions, finalAnswers, scoring)
      await supabase
        .from('attempts')
        .update({
          finished_at: new Date().toISOString(),
          answers: finalAnswers,
          raw_score: r.raw,
          section_scores: r.sectionScores,
          cefr: r.band.cefr,
          projected_score: r.projected,
        })
        .eq('id', attempt.id)
      navigate('/results')
    },
    [attempt, test, questions, navigate],
  )

  useEffect(() => {
    if (phase === 'running' && remaining === 0 && endsAt > 0) finish(answers)
  }, [phase, remaining, endsAt, answers, finish])

  async function start() {
    if (!test || !session) return
    setPhase('loading')
    const ends = Date.now() + (test.duration_min ?? 25) * 60000
    const { data: a } = await supabase
      .from('attempts')
      .insert({
        user_id: session.user.id,
        test_id: test.id,
        kind: 'diagnostic',
        answers: {},
        state: { idx: 0, ends_at: ends },
      })
      .select()
      .single()
    const created = a as unknown as Attempt
    const qs = groupByPassage(await resolveTestQuestions(test, created.id))
    setQuestions(qs)
    setAttempt(created)
    setEndsAt(ends)
    setIdx(0)
    setPhase('running')
  }

  // sauvegarde de l'état à chaque réponse (reprise possible après coupure, §5.3)
  async function answer(qid: string, val: number[]) {
    const next = { ...answers, [qid]: val }
    setAnswers(next)
    if (attempt)
      supabase
        .from('attempts')
        .update({ answers: next, state: { idx, ends_at: endsAt } })
        .eq('id', attempt.id)
        .then(() => {})
  }

  async function goNext() {
    const last = idx >= questions.length - 1
    if (last) {
      await finish(answers)
      return
    }
    const n = idx + 1
    setIdx(n)
    if (attempt)
      supabase
        .from('attempts')
        .update({ state: { idx: n, ends_at: endsAt } })
        .eq('id', attempt.id)
        .then(() => {})
  }

  const q = questions[idx]
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  const progress = useMemo(
    () => (questions.length ? Math.round(((idx + 1) / questions.length) * 100) : 0),
    [idx, questions.length],
  )

  if (phase === 'loading') return <Spinner />

  if (phase === 'blocked')
    return (
      <ScreenShell>
        <div className="pt-5"><BrandLogo size="sm" /></div>
        <div className="card mt-8 text-center flex flex-col gap-4">
          <span className="text-3xl">🔒</span>
          <p className="text-[13.5px] text-muted">{t('diag.already')}</p>
          <Link to="/results" className="btn green">{t('diag.already.results')}</Link>
        </div>
      </ScreenShell>
    )

  if (phase === 'intro')
    return (
      <ScreenShell>
        <div className="pt-5"><BrandLogo size="sm" /></div>
        <h1 className="mt-7 text-[22px] font-extrabold">{t('diag.intro.title')}</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">{t('diag.intro.sub')}</p>
        <div className="card mt-5 flex flex-col gap-3">
          {[t('diag.intro.rule1'), t('diag.intro.rule2'), t('diag.intro.rule3')].map((r, i) => (
            <div key={i} className="flex gap-2.5 items-start text-[13px] leading-snug">
              <span className="flex-none w-[18px] h-[18px] rounded-full bg-green text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {r}
            </div>
          ))}
        </div>
        <button className="btn mt-5" onClick={start}>
          {t('diag.intro.start')}
        </button>
      </ScreenShell>
    )

  if (!q) return <Spinner />

  return (
    <ScreenShell>
      {/* méta : n° de question + timer, comme l'écran 2 de la maquette */}
      <div className="flex justify-between items-center pt-5 mono text-[12px] text-muted">
        <span>
          {t('diag.question')} {String(idx + 1).padStart(2, '0')} / {questions.length}
        </span>
        <span className={remaining < 120 ? 'text-red font-medium' : ''}>⏱ {mm}:{ss}</span>
      </div>
      <div className="progress mt-2.5">
        <i style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-4">
        <QuestionCard question={q} answer={answers[q.id]} onAnswer={(v) => answer(q.id, v)} />
      </div>

      <button className="btn green mt-5" onClick={goNext} disabled={!answers[q.id]?.length}>
        {idx >= questions.length - 1 ? t('diag.finish') : t('diag.next')}
      </button>
      <p className="text-center text-[11px] text-muted mt-2">
        {locale === 'fr' ? 'Réponse enregistrée automatiquement' : 'Answer saved automatically'}
      </p>
    </ScreenShell>
  )
}
