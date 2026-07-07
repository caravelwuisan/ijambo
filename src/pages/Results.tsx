import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { DEFAULT_SCORING, intensivePace, pathMilestones } from '../lib/scoring'
import type { Attempt, Plan, Scoring } from '../lib/types'
import { BrandLogo, Hills, ScreenShell, Spinner } from '../components/ui'

const GOAL_LABELS: Record<string, { fr: string; en: string; target: string }> = {
  usa: { fr: 'Objectif bourse : TOEFL 85+', en: 'Scholarship goal: TOEFL 85+', target: '85+' },
  china: { fr: 'Objectif bourse Chine : TOEFL 80+', en: 'China scholarship goal: TOEFL 80+', target: '80+' },
  regional: { fr: 'Objectif université régionale : TOEFL 70+', en: 'Regional university goal: TOEFL 70+', target: '70+' },
  other: { fr: 'Objectif : TOEFL 80+', en: 'Goal: TOEFL 80+', target: '80+' },
}

export default function Results() {
  const { t, locale } = useI18n()
  const { session, profile } = useAuth()
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [scoring, setScoring] = useState<Scoring>(DEFAULT_SCORING)
  const [firstPlan, setFirstPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    ;(async () => {
      const { data: a } = await supabase
        .from('attempts')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('kind', 'diagnostic')
        .not('finished_at', 'is', null)
        .order('finished_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setAttempt(a as unknown as Attempt)
      if (a?.test_id) {
        const { data: test } = await supabase.from('tests').select('scoring').eq('id', a.test_id).maybeSingle()
        if (test?.scoring) setScoring(test.scoring as Scoring)
      }
      const { data: plans } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('sort')
        .limit(1)
      setFirstPlan((plans?.[0] as unknown as Plan) ?? null)
      setLoading(false)
    })()
  }, [session])

  if (loading) return <Spinner />
  if (!attempt)
    return (
      <ScreenShell>
        <div className="pt-5"><BrandLogo size="sm" /></div>
        <div className="card mt-8 text-center flex flex-col gap-4">
          <p className="text-[13.5px] text-muted">
            {locale === 'fr' ? "Vous n'avez pas encore passé le test de niveau." : 'You have not taken the level test yet.'}
          </p>
          <Link to="/diagnostic" className="btn">{t('home.cta.start')}</Link>
        </div>
      </ScreenShell>
    )

  const raw = Number(attempt.raw_score ?? 0)
  const band = scoring.bands.find((b) => raw >= b.min && raw <= b.max) ?? scoring.bands[0]
  const weeks = band.program_weeks
  const goal = GOAL_LABELS[profile?.goal ?? 'other'] ?? GOAL_LABELS.other
  const pace = intensivePace(profile?.target_exam_date ?? null, weeks)
  const miles = pathMilestones(pace.weeks)
  const recommendDET = (attempt.projected_score ?? 0) < (scoring.det_recommendation_threshold ?? 60)

  return (
    <ScreenShell>
      <div className="flex items-center justify-between pt-5">
        <BrandLogo size="sm" />
        <span className="pill">{t('results.pill')}</span>
      </div>

      {/* niveau + score projeté */}
      <div className="card mt-5 flex justify-between items-center">
        <div>
          <p className="text-[11.5px] text-muted">{t('results.level')}</p>
          <div className="score-big">{attempt.cefr}</div>
        </div>
        <div className="text-right">
          <p className="text-[11.5px] text-muted">{t('results.projected')}</p>
          <div className="score-big">
            {attempt.projected_score} <span>/120</span>
          </div>
        </div>
      </div>

      {/* chemin vers l'examen */}
      <div className="path-card mt-4">
        <h4 className="text-[13px] font-bold mb-0.5 relative z-10">🎯 {locale === 'en' ? goal.en : goal.fr}</h4>
        <span className="mono text-gold text-[12px] relative z-10">
          {t('results.path')} : {pace.weeks} {t('results.weeks')} · {pace.hours} {t('results.hoursWeek')}
        </span>
        <div className="flex justify-between mt-3 relative z-10">
          <Mile on label={t('results.today')} sub={`${attempt.cefr} · ${attempt.projected_score}`} />
          <Mile label={`${t('results.week')} ${miles.mock1}`} sub={t('results.mock1')} />
          <Mile label={`${t('results.week')} ${miles.mock2}`} sub={t('results.mock2')} />
          <Mile end label={`${t('results.week')} ${miles.examDay}`} sub={`${t('results.examday')} · ${goal.target}`} />
        </div>
        <Hills className="opacity-30" />
      </div>

      {pace.intensive && (
        <div className="card mt-4 !bg-gold-soft !border-gold">
          <p className="text-[12.5px] leading-relaxed text-gold-ink">{t('results.warning.date', { hours: pace.hours })}</p>
        </div>
      )}

      {recommendDET && (
        <div className="card mt-4">
          <p className="text-[12.5px] leading-relaxed text-muted">
            <b className="text-ink">{t('results.advice.title')}</b>{' '}
            <span dangerouslySetInnerHTML={{ __html: t('results.advice.det').replace(/Duolingo English Test/, '<b style="color:var(--ink)">Duolingo English Test</b>') }} />
          </p>
        </div>
      )}

      <button className="btn mt-5" onClick={() => navigate('/pricing')}>
        {t('results.cta')}
        {firstPlan ? ` — ${firstPlan.price_bif.toLocaleString('fr-FR')} BIF` : ''}
      </button>
    </ScreenShell>
  )
}

function Mile({ on = false, end = false, label, sub }: { on?: boolean; end?: boolean; label: string; sub: string }) {
  return (
    <div className="flex-1 text-center">
      <div
        className="w-[11px] h-[11px] rounded-full mx-auto mb-1.5 border-2"
        style={{
          background: on ? 'var(--gold)' : end ? 'var(--red)' : '#3A4A40',
          borderColor: on ? 'var(--gold)' : end ? '#fff' : '#6E8377',
        }}
      />
      <div className="text-[9.5px] leading-tight text-[#B8C4BB]">
        <b className="block text-white text-[10px]">{label}</b>
        {sub}
      </div>
    </div>
  )
}
