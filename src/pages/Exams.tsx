import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { Attempt, Exam } from '../lib/types'
import { ScreenShell, Spinner } from '../components/ui'

export default function Exams() {
  const { t, locale } = useI18n()
  const { session } = useAuth()
  const [exams, setExams] = useState<Exam[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [quota, setQuota] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    ;(async () => {
      const [{ data: ex }, { data: at }, { data: enr }] = await Promise.all([
        supabase.from('exams').select('*').eq('status', 'published').order('name'),
        supabase.from('attempts').select('*').eq('user_id', session.user.id).eq('kind', 'exam').order('started_at', { ascending: false }),
        supabase
          .from('enrollments')
          .select('plan:plans(exam_quota)')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .gt('expires_at', new Date().toISOString()),
      ])
      setExams((ex as unknown as Exam[]) ?? [])
      setAttempts((at as unknown as Attempt[]) ?? [])
      setQuota(Math.max(...((enr ?? []).map((e: any) => e.plan?.exam_quota ?? 0)), 0))
      setLoading(false)
    })()
  }, [session])

  if (loading) return <Spinner />

  const used = attempts.filter((a) => a.finished_at).length
  const left = Math.max(0, quota - used)

  return (
    <ScreenShell>
      <div className="pt-5">
        <Link to="/dashboard" className="text-[13px] text-green font-semibold no-underline">← {t('common.back')}</Link>
      </div>
      <div className="flex items-center justify-between mt-4">
        <h1 className="text-[20px] font-extrabold">{t('exam.title')}</h1>
        <span className={`pill ${left ? '' : 'red'}`}>{left} {t('exam.quota')}</span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {exams.map((e) => {
          const totalMin = e.sections.reduce((a, s) => a + (s.duration_min || 0), 0)
          return (
            <div key={e.id} className="card">
              <div className="flex items-center justify-between">
                <b className="text-[14px]">{e.name}</b>
                <span className="pill gold">{e.target.toUpperCase()}</span>
              </div>
              <p className="text-[11.5px] text-muted mt-1">
                {e.sections.map((s) => `${s.name} ${s.duration_min}′`).join(' → ')} · {Math.round(totalMin / 60)} h{' '}
                {totalMin % 60 ? `${totalMin % 60}′` : ''}
              </p>
              {left > 0 ? (
                <Link to={`/exam/${e.id}`} className="btn green mt-3">{t('exam.start')}</Link>
              ) : (
                <p className="text-[12px] text-red font-semibold mt-3">{t('exam.noquota')}</p>
              )}
            </div>
          )
        })}
      </div>

      {attempts.filter((a) => a.finished_at).length > 0 && (
        <>
          <h2 className="text-[13px] font-bold text-muted uppercase tracking-wide mt-6 mb-2">{t('exam.compare')}</h2>
          <div className="flex flex-col gap-2">
            {attempts
              .filter((a) => a.finished_at)
              .map((a) => (
                <div key={a.id} className="card !py-2.5 flex items-center gap-2 text-[12.5px]">
                  <span className="text-muted">{new Date(a.finished_at!).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}</span>
                  <span className="mono text-green ml-auto">
                    {Object.entries(a.section_scores ?? {})
                      .map(([k, v]) => `${k.slice(0, 1).toUpperCase()}${v}%`)
                      .join(' · ')}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}
    </ScreenShell>
  )
}
