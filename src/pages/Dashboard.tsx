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
  const [totalLessons, setTotalLessons] = useState(0)
  const [completedLessons, setCompletedLessons] = useState(0)

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
        const lessonList = (lessons as Lesson[]) ?? []
        setTotalLessons(lessonList.length)
        setCompletedLessons(doneSet.size)
        setModules(
          moduleList.map((m) => {
            const ls = lessonList.filter((l) => l.module_id === m.id)
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
  const firstIncomplete = modules.flatMap(m => m.nextLesson ? m : []).length > 0
    ? modules.find(m => m.nextLesson)?.nextLesson
    : null

  // Badges basés sur les accomplissements
  const badges = [
    streak >= 3 ? { emoji: '🔥', text: `${streak} ${locale === 'fr' ? 'jours' : 'days'}` } : null,
    completedLessons >= 5 ? { emoji: '⭐', text: locale === 'fr' ? '5 leçons' : '5 lessons' } : null,
    globalPct >= 50 ? { emoji: '🏆', text: locale === 'fr' ? 'Mi-parcours' : 'Halfway' } : null,
  ].filter(Boolean)

  return (
    <ScreenShell>
      <Header
        name={`${profile?.first_name ?? ''} ${(profile?.last_name ?? '').charAt(0)}.`}
        sub={`${t('dash.week')} ${startedWeeks}/${weeks}`}
        streak={streak}
      />

      {/* HERO SECTION — À faire maintenant */}
      {firstIncomplete && (
        <div className="mt-4 bg-green-soft border-2 border-green rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute top-2 right-2 text-3xl opacity-20">✨</div>
          <p className="text-[11px] font-bold text-green opacity-90 mb-1">
            {locale === 'fr' ? '⚡ À FAIRE MAINTENANT' : '⚡ DO THIS NOW'}
          </p>
          <h2 className="text-[16px] font-extrabold text-ink mb-2">{firstIncomplete.title}</h2>
          <p className="text-[12px] text-muted mb-3">
            {locale === 'fr' ? '~' : '~'} {firstIncomplete.est_minutes} min
          </p>
          <Link
            to={`/lesson/${firstIncomplete.id}`}
            className="inline-block bg-green text-white px-5 py-2.5 rounded-lg font-bold text-[13px] no-underline"
          >
            {locale === 'fr' ? 'Commencer →' : 'Start →'}
          </Link>
        </div>
      )}

      {/* STATS PERSONNELLES */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="card text-center">
          <p className="text-2xl">📊</p>
          <p className="text-[12px] font-bold text-green">{globalPct}%</p>
          <p className="text-[10px] text-muted">{locale === 'fr' ? 'Complété' : 'Done'}</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl">📚</p>
          <p className="text-[12px] font-bold text-green">{completedLessons}/{totalLessons}</p>
          <p className="text-[10px] text-muted">{locale === 'fr' ? 'Leçons' : 'Lessons'}</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl">⏱️</p>
          <p className="text-[12px] font-bold text-green">{startedWeeks}/{weeks}</p>
          <p className="text-[10px] text-muted">{locale === 'fr' ? 'Semaines' : 'Weeks'}</p>
        </div>
      </div>

      {/* BADGES & RÉCOMPENSES */}
      {badges.length > 0 && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {badges.map((badge, i) => (
            <div key={i} className="pill green">
              {badge.emoji} {badge.text}
            </div>
          ))}
        </div>
      )}

      {/* PROGRESSION GLOBALE */}
      <div className="card mt-3">
        <div className="flex justify-between mb-2">
          <p className="text-[12px] font-bold">{locale === 'fr' ? 'Objectif' : 'Goal'} {target}</p>
          <span className="mono text-[12px] text-green font-bold">{globalPct}%</span>
        </div>
        <div className="progress">
          <i style={{ width: `${globalPct}%` }} />
        </div>
      </div>

      {/* MODULES & LEÇONS */}
      <p className="text-[12px] font-bold text-muted mt-4">{locale === 'fr' ? 'MON PARCOURS' : 'MY PROGRAM'}</p>
      <div className="mt-2 flex flex-col gap-2">
        {modules.map((m) => {
          const pct = m.total ? Math.round((m.done / m.total) * 100) : 0
          return (
            <Link
              key={m.id}
              to={m.nextLesson ? `/lesson/${m.nextLesson.id}` : `/module/${m.id}`}
              className="flex items-center gap-3 bg-card border border-line rounded-xl px-3 py-2.5 no-underline text-ink hover:border-green transition"
            >
              <div className="w-10 h-10 rounded-lg bg-green-soft flex items-center justify-center text-lg flex-shrink-0">
                {m.icon ?? MODULE_ICONS[m.name] ?? '📚'}
              </div>
              <div className="flex-1 min-w-0">
                <b className="text-[13px] block">{m.name}</b>
                <span className="text-[11px] text-muted truncate block">
                  {m.nextLesson
                    ? `${locale === 'fr' ? 'Leçon' : 'Lesson'} ${m.done + 1}/${m.total}`
                    : m.total
                      ? '✓ ' + (locale === 'fr' ? 'Complété' : 'Done')
                      : locale === 'fr' ? 'Bientôt' : 'Soon'}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-12 h-1.5 bg-line rounded-full overflow-hidden">
                  <div style={{ width: `${pct}%` }} className="h-full bg-green transition" />
                </div>
                <span className="mono text-[11px] text-green font-bold w-6 text-right">{pct}%</span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* QUICK ACTIONS */}
      <p className="text-[12px] font-bold text-muted mt-4">{locale === 'fr' ? 'ACTIONS RAPIDES' : 'QUICK ACTIONS'}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Link to="/exams" className="card bg-gold-soft border-2 border-gold no-underline text-center py-3 rounded-xl">
          <p className="text-2xl">📅</p>
          <p className="text-[12px] font-bold text-gold">{locale === 'fr' ? 'Test blanc' : 'Mock test'}</p>
        </Link>
        <Link to="/coaching" className="card bg-red-soft border-2 border-red no-underline text-center py-3 rounded-xl">
          <p className="text-2xl">🗣️</p>
          <p className="text-[12px] font-bold text-red">{locale === 'fr' ? 'Coaching' : 'Coaching'}</p>
        </Link>
      </div>

      {/* SESSIONS LIVE */}
      {(liveLinks.speaking || liveLinks.writing) && (
        <div className="card mt-3 !border-gold">
          <p className="text-[12px] font-bold mb-2">🔴 {locale === 'fr' ? 'EN DIRECT' : 'LIVE NOW'}</p>
          <div className="flex gap-2">
            {liveLinks.speaking && (
              <a href={liveLinks.speaking} target="_blank" rel="noopener" className="btn green sm flex-1">
                {locale === 'fr' ? 'Speaking' : 'Speaking'}
              </a>
            )}
            {liveLinks.writing && (
              <a href={liveLinks.writing} target="_blank" rel="noopener" className="btn green sm flex-1">
                {locale === 'fr' ? 'Writing' : 'Writing'}
              </a>
            )}
          </div>
        </div>
      )}

      <button
        className="text-[11px] text-muted bg-transparent border-0 cursor-pointer mt-5 underline"
        onClick={() => supabase.auth.signOut().then(() => navigate('/'))}
      >
        {locale === 'fr' ? 'Déconnexion' : 'Logout'}
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
