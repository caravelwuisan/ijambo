import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { Lesson, Module } from '../lib/types'
import { ScreenShell, Spinner } from '../components/ui'

export default function ModulePage() {
  const { moduleId } = useParams()
  const { t, locale } = useI18n()
  const { session } = useAuth()
  const [module, setModule] = useState<Module | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [doneSet, setDoneSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session || !moduleId) return
    ;(async () => {
      const [{ data: m }, { data: ls }, { data: prog }] = await Promise.all([
        supabase.from('modules').select('*').eq('id', moduleId).single(),
        supabase.from('lessons').select('*').eq('module_id', moduleId).eq('status', 'published').order('sort'),
        supabase.from('lesson_progress').select('lesson_id, completed_at').eq('user_id', session.user.id),
      ])
      setModule(m as Module)
      setLessons((ls as Lesson[]) ?? [])
      setDoneSet(new Set((prog ?? []).filter((p: any) => p.completed_at).map((p: any) => p.lesson_id)))
      setLoading(false)
    })()
  }, [session, moduleId])

  if (loading) return <Spinner />

  return (
    <ScreenShell>
      <div className="pt-5">
        <Link to="/dashboard" className="text-[13px] text-green font-semibold no-underline">← {t('common.back')}</Link>
      </div>
      <h1 className="mt-4 text-[20px] font-extrabold">
        {module?.icon} {module?.name}
      </h1>
      <div className="mt-4 flex flex-col gap-2">
        {lessons.map((l, i) => {
          const done = doneSet.has(l.id)
          return (
            <Link key={l.id} to={`/lesson/${l.id}`} className="flex items-center gap-3 bg-card border border-line rounded-xl px-3 py-3 no-underline text-ink">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-none"
                style={{ background: done ? 'var(--green)' : 'var(--green-soft)', color: done ? '#fff' : 'var(--green)' }}
              >
                {done ? '✓' : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <b className="text-[13px] block">{l.title}</b>
                <span className="text-[11px] text-muted">
                  {l.est_minutes ?? 20} {t('lesson.minutes')}
                  {l.quiz_test_id && ` · ${locale === 'fr' ? 'quiz' : 'quiz'} ≥ ${l.pass_threshold}%`}
                </span>
              </div>
            </Link>
          )
        })}
        {!lessons.length && (
          <p className="text-[13px] text-muted">{locale === 'fr' ? 'Les leçons arrivent bientôt.' : 'Lessons coming soon.'}</p>
        )}
      </div>
    </ScreenShell>
  )
}
