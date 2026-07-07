import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { Course, Enrollment, Lesson, Module } from '../lib/types'
import { LangSwitch, ScreenShell, Spinner } from '../components/ui'

type ModuleView = Module & { total: number; done: number; nextLesson: Lesson | null }

const GOAL_TARGET: Record<string, string> = { usa: '85+', china: '80+', regional: '70+', other: '80+' }

export default function Dashboard() {
  const { t, locale } = useI18n()
  const { session, profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<ModuleView[]>([])
  const [streak, setStreak] = useState(0)
  const [liveLinks, setLiveLinks] = useState<Record<string, string>>({})
  const [hasExamAccess, setHasExamAccess] = useState(false)

  useEffect(() => {
    if (!session) return
    ;(async () => {
      const { data: enr } = await supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const e = enr as unknown as Enrollment | null
      setEnrollment(e)

      if (e?.course_id) {
        const [{ data: c }, { data: mods }] = await Promise.all([
          supabase.from('courses').select('*').eq('id', e.course_id).single(),
          supabase.from('modules').select('*').eq('course_id', e.course_id).order('sort'),
        ])
        setCourse(c as Course)
        const moduleList = (mods as Module[]) ?? []
        const ids = moduleList.map((m) => m.id)
        const [{ data: lessons }, { data: progress }] = await Promise.all([
          ids.length
            ? supabase.from('lessons').select('*').in('module_id', ids).eq('status', 'published').order('sort')
            : Promise.resolve({ data: [] as Lesson[] }),
          supabase.from('lesson_progress').select('lesson_id, completed_at').eq('user_id', session.user.id),
        ])
        const doneSet = new Set((progress ?? []).filter((p: any) => p.completed_at).map((p: any) => p.lesson_id))
        setModules(
          moduleList.map((m) => {
            const ls = ((lessons as Lesson[]) ?? []).filter((l) => l.module_id === m.id)
            return {
              ...m,
              total: ls.length,
              done: ls.filter((l) => doneSet.has(l.id)).length,
              nextLesson: ls.find((l) => !doneSet.has(l.id)) ?? null,
            }
          }),
        )
        setHasExamAccess(true)
      }

      const [{ data: st }, { data: links }] = await Promise.all([
        supabase.rpc('current_streak'),
        supabase.from('app_settings').select('value').eq('key', 'live_session_links').maybeSingle(),
      ])
      if (typeof st === 'number') setStreak(st)
      if (links?.value) setLiveLinks(links.value as Record<string, string>)
      setLoading(false)
    })()
  }, [session])

  if (loading) return <Spinner />

  // pas d'accès actif → renvoi vers les formules (ou résultats du diagnostic)
  if (!enrollment)
    return (
      <ScreenShell>
        <Header name={profile?.first_name ?? ''} sub="" streak={streak} />
        <div className="card mt-6 text-center flex flex-col gap-4">
          <span className="text-3xl">🔓</span>
          <p className="text-[13.5px] text-muted">{t('dash.locked')}</p>
          <Link to="/pricing" className="btn">{t('dash.renew')}</Link>
          <Link to="/results" className="text-[13px] text-green font-semibold no-underline">
            {t('diag.already.results')}
          </Link>
        </div>
      </ScreenShell>
    )

  const total = modules.reduce((a, m) => a + m.total, 0)
  const done = modules.reduce((a, m) => a + m.done, 0)
  const globalPct = total ? Math.round((done / total) * 100) : 0
  const weeks = course?.duration_weeks ?? 10
  const startedWeeks = Math.min(
    weeks,
    Math.max(1, Math.ceil((Date.now() - new Date(enrollment.starts_at).getTime()) / (7 * 86400000))),
  )
  const target = GOAL_TARGET[profile?.goal ?? 'other'] ?? '80+'

  const MODULE_ICONS: Record<string, string> = { Listening: '🎧', Reading: '📖', Writing: '✍️', Speaking: '🗣' }

  return (
    <ScreenShell>
      <Header
        name={`${profile?.first_name ?? ''} ${(profile?.last_name ?? '').charAt(0)}.`}
        sub={`${t('dash.week')} ${startedWeeks}/${weeks}`}
        streak={streak}
      />

      {/* progression globale */}
      <div className="card mt-4">
        <div className="flex justify-between mb-1.5">
          <p className="text-[12px] font-bold">
            {t('dash.progress')} {target}
          </p>
          <span className="mono text-[12px] text-green">{globalPct}%</span>
        </div>
        <div className="progress">
          <i style={{ width: `${globalPct}%` }} />
        </div>
      </div>

      {/* 4 modules avec prochaine leçon */}
      <div className="mt-3 flex flex-col gap-2">
        {modules.map((m) => {
          const pct = m.total ? Math.round((m.done / m.total) * 100) : 0
          return (
            <Link
              key={m.id}
              to={m.nextLesson ? `/lesson/${m.nextLesson.id}` : `/module/${m.id}`}
              className="flex items-center gap-3 bg-card border border-line rounded-xl px-3 py-2.5 no-underline text-ink"
            >
              <div className="w-9 h-9 rounded-[9px] bg-green-soft flex items-center justify-center text-lg">
                {m.icon ?? MODULE_ICONS[m.name] ?? '📚'}
              </div>
              <div className="flex-1 min-w-0">
                <b className="text-[13px] block">{m.name}</b>
                <span className="text-[11px] text-muted truncate block">
                  {m.nextLesson
                    ? `${locale === 'fr' ? 'Leçon' : 'Lesson'} ${m.done + 1} · ${m.nextLesson.title}`
                    : m.total
                      ? '✓ ' + (locale === 'fr' ? 'Module terminé' : 'Module completed')
                      : locale === 'fr' ? 'Bientôt disponible' : 'Coming soon'}
                </span>
              </div>
              <span className="mono text-[12px] text-green">{pct}%</span>
            </Link>
          )
        })}
      </div>

      {/* prochain test blanc */}
      <Link to="/exams" className="card mt-3 !bg-green-soft !border-green no-underline block">
        <p className="text-[12.5px] leading-relaxed text-ink">
          <b className="text-green">📅 {t('dash.nextmock')}</b> —{' '}
          {locale === 'fr'
            ? 'conditions réelles, résultat immédiat pour Reading et Listening.'
            : 'real conditions, instant results for Reading and Listening.'}
        </p>
      </Link>

      {/* sessions live + coaching */}
      {(liveLinks.speaking || liveLinks.writing) && (
        <div className="card mt-3">
          <p className="text-[12px] font-bold mb-2">🔴 {t('dash.live')}</p>
          <div className="flex gap-2">
            {liveLinks.speaking && (
              <a href={liveLinks.speaking} target="_blank" rel="noopener" className="btn green sm flex-1">Speaking</a>
            )}
            {liveLinks.writing && (
              <a href={liveLinks.writing} target="_blank" rel="noopener" className="btn green sm flex-1">Writing</a>
            )}
          </div>
        </div>
      )}

      <Link to="/coaching" className="btn ghost mt-3">
        {locale === 'fr' ? 'Coaching présentiel — Bujumbura' : 'In-person coaching — Bujumbura'}
      </Link>

      <button
        className="text-[12px] text-muted bg-transparent border-0 cursor-pointer mt-4 underline"
        onClick={() => supabase.auth.signOut().then(() => navigate('/'))}
      >
        {t('auth.logout')}
      </button>
    </ScreenShell>
  )
}

function Header({ name, sub, streak }: { name: string; sub: string; streak: number }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-between pt-5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-green text-white flex items-center justify-center font-extrabold text-[13px]">
          {name.charAt(0) || 'IJ'}
        </div>
        <span className="font-extrabold text-[13.5px]">
          {name}
          {sub && <span className="text-muted font-semibold"> · {sub}</span>}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {streak > 0 && <span className="pill red">🔥 {streak} {t('dash.streak')}</span>}
        <LangSwitch />
      </div>
    </div>
  )
}
