import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { renderMarkdown } from '../lib/markdown'
import { resolveTestQuestions } from '../lib/questions'
import { isCorrect } from '../lib/scoring'
import type { Lesson, Question, Test } from '../lib/types'
import QuestionCard from '../components/QuestionCard'
import { ScreenShell, Spinner } from '../components/ui'

export default function LessonPage() {
  const { lessonId } = useParams()
  const { t, locale } = useI18n()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [siblings, setSiblings] = useState<Lesson[]>([])
  const [phase, setPhase] = useState<'read' | 'quiz' | 'result'>('read')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, number[]>>({})
  const [qIdx, setQIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!lessonId) return
    setPhase('read')
    setAnswers({})
    setQIdx(0)
    ;(async () => {
      setLoading(true)
      const { data: l } = await supabase.from('lessons').select('*').eq('id', lessonId).single()
      const les = l as Lesson
      setLesson(les)
      if (les) {
        const { data: sibs } = await supabase
          .from('lessons')
          .select('*')
          .eq('module_id', les.module_id)
          .eq('status', 'published')
          .order('sort')
        setSiblings((sibs as Lesson[]) ?? [])
      }
      setLoading(false)
    })()
  }, [lessonId])

  async function startQuiz() {
    if (!lesson?.quiz_test_id) {
      await complete(100)
      return
    }
    setLoading(true)
    const { data: test } = await supabase.from('tests').select('*').eq('id', lesson.quiz_test_id).single()
    const qs = await resolveTestQuestions(test as unknown as Test)
    setQuestions(qs)
    setLoading(false)
    setPhase(qs.length ? 'quiz' : 'read')
    if (!qs.length) await complete(100)
  }

  async function complete(pct: number) {
    if (!session || !lesson) return
    const passed = pct >= lesson.pass_threshold
    await supabase.from('lesson_progress').upsert({
      user_id: session.user.id,
      lesson_id: lesson.id,
      quiz_score: pct,
      completed_at: passed ? new Date().toISOString() : null,
    })
    setScore(pct)
    setPhase('result')
  }

  async function submitQuiz(final: Record<string, number[]>) {
    const good = questions.filter((q) => isCorrect(q, final[q.id])).length
    const pct = questions.length ? Math.round((good / questions.length) * 100) : 100
    await complete(pct)
  }

  if (loading || !lesson) return <Spinner />

  const idx = siblings.findIndex((s) => s.id === lesson.id)
  const prev = siblings[idx - 1]
  const next = siblings[idx + 1]
  const passed = score >= lesson.pass_threshold

  if (phase === 'quiz') {
    const q = questions[qIdx]
    return (
      <ScreenShell>
        <div className="flex justify-between items-center pt-5 mono text-[12px] text-muted">
          <span>{t('lesson.quiz').toUpperCase()}</span>
          <span>{qIdx + 1} / {questions.length}</span>
        </div>
        <div className="progress mt-2.5">
          <i style={{ width: `${Math.round(((qIdx + 1) / questions.length) * 100)}%` }} />
        </div>
        <div className="mt-4">
          <QuestionCard question={q} answer={answers[q.id]} onAnswer={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
        </div>
        <button
          className="btn green mt-5"
          disabled={!answers[q.id]?.length}
          onClick={() => {
            if (qIdx < questions.length - 1) setQIdx(qIdx + 1)
            else submitQuiz(answers)
          }}
        >
          {qIdx < questions.length - 1 ? t('diag.next') : t('diag.finish')}
        </button>
      </ScreenShell>
    )
  }

  if (phase === 'result')
    return (
      <ScreenShell>
        <div className="pt-16 text-center">
          <span className="text-5xl">{passed ? '🎉' : '📖'}</span>
          <h1 className="mt-4 text-[20px] font-extrabold">{passed ? t('lesson.quiz.pass') : t('lesson.quiz.fail')}</h1>
          <div className="score-big mt-4">
            {score}
            <span>%</span>
          </div>
          <p className="text-[12px] text-muted mt-1">
            {t('lesson.quiz.score')} · {locale === 'fr' ? 'seuil' : 'threshold'} {lesson.pass_threshold}%
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {passed && next && (
              <Link to={`/lesson/${next.id}`} className="btn">
                {t('lesson.next')} → {next.title}
              </Link>
            )}
            {!passed && (
              <button className="btn green" onClick={() => setPhase('read')}>
                {locale === 'fr' ? 'Relire la leçon' : 'Review the lesson'}
              </button>
            )}
            <Link to="/dashboard" className="btn ghost">{t('common.back')}</Link>
          </div>
        </div>
      </ScreenShell>
    )

  return (
    <ScreenShell>
      <div className="pt-5 flex items-center justify-between">
        <Link to={`/module/${lesson.module_id}`} className="text-[13px] text-green font-semibold no-underline">
          ← {t('common.back')}
        </Link>
        <span className="pill">{lesson.est_minutes ?? 20} {t('lesson.minutes')}</span>
      </div>
      <h1 className="mt-4 text-[20px] font-extrabold leading-tight">{lesson.title}</h1>

      {lesson.audio_url && <audio controls preload="none" src={lesson.audio_url} className="w-full mt-4" />}

      <div className="lesson-body mt-4" dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.body_md ?? '') }} />

      <button className="btn mt-6" onClick={startQuiz}>
        {lesson.quiz_test_id ? t('lesson.quiz.start') : locale === 'fr' ? 'Marquer comme terminée' : 'Mark as completed'}
      </button>

      <div className="flex justify-between mt-4 text-[13px]">
        {prev ? (
          <Link to={`/lesson/${prev.id}`} className="text-green font-semibold no-underline">← {t('lesson.prev')}</Link>
        ) : <span />}
        {next && (
          <Link to={`/lesson/${next.id}`} className="text-green font-semibold no-underline">{t('lesson.next')} →</Link>
        )}
      </div>
    </ScreenShell>
  )
}
