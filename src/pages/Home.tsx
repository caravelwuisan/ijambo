import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { Hills, LangSwitch, OfflineBanner, StatCard } from '../components/ui'

export default function Home() {
  const { t, locale } = useI18n()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [studentCount, setStudentCount] = useState<number | null>(null)
  const [stats, setStats] = useState({ questions: '200+', mock_tests: '4', max_data: '2 Go' })

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase.rpc('public_student_count').then(({ data }) => {
      if (typeof data === 'number') setStudentCount(data)
    })
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'home_stats')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setStats(data.value as typeof stats)
      })
  }, [])

  return (
    <div className="min-h-dvh bg-paper">
      <OfflineBanner />
      {/* En-tête sombre avec collines — signature graphique */}
      <header className="relative bg-ink text-paper px-5 pt-8 pb-24 overflow-hidden">
        <div className="max-w-md mx-auto relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-green text-white flex items-center justify-center font-extrabold text-base">
                IJ
              </div>
              <span className="font-extrabold text-base tracking-wide">
                IJAMBO <span className="text-gold">English</span>
              </span>
            </div>
            <LangSwitch dark />
          </div>
          <h1 className="mt-7 text-[27px] leading-[1.2] font-extrabold">
            {t('home.greeting')}
            <br />
            {t('home.headline')} <em className="not-italic text-gold">{t('home.headline.em')}</em>.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-[#B8C4BB]">{t('home.sub')}</p>
        </div>
        <Hills />
      </header>

      <main className="max-w-md mx-auto px-5 -mt-12 relative z-10 flex flex-col gap-4 pb-12">
        <div className="flex gap-3">
          <StatCard n={stats.questions} label={t('home.stat.questions')} />
          <StatCard n={stats.mock_tests} label={t('home.stat.exams')} />
          <StatCard n={stats.max_data} label={t('home.stat.data')} />
        </div>

        {session ? (
          <button className="btn" onClick={() => navigate('/dashboard')}>
            {locale === 'fr' ? 'Continuer mon programme' : 'Continue my programme'}
          </button>
        ) : (
          <>
            <Link to="/register" className="btn">
              {t('home.cta.start')}
            </Link>
            <Link to="/login" className="btn ghost">
              {t('home.cta.login')}
            </Link>
          </>
        )}

        <div className="card flex gap-3 items-center">
          <span className="text-2xl">🎓</span>
          <p className="text-xs text-muted leading-relaxed">
            <b className="text-ink">
              {(studentCount ?? 1240).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')}{' '}
              {t('home.social.students')}
            </b>{' '}
            {t('home.social.suffix')}
          </p>
        </div>
      </main>
    </div>
  )
}
