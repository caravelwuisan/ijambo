import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { Plan } from '../lib/types'
import { BrandLogo, LangSwitch, ScreenShell, Spinner } from '../components/ui'

export default function Pricing() {
  const { t, locale } = useI18n()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort')
      .then(({ data }) => {
        setPlans((data as unknown as Plan[]) ?? [])
        setLoading(false)
      })
  }, [])

  function choose(plan: Plan) {
    if (!session) {
      navigate('/register')
      return
    }
    navigate(`/pay/${plan.id}`)
  }

  if (loading) return <Spinner />

  return (
    <ScreenShell max="max-w-2xl">
      <div className="flex items-center justify-between pt-5">
        <BrandLogo size="sm" />
        <LangSwitch />
      </div>
      <h1 className="mt-6 text-[22px] font-extrabold leading-tight">{t('pricing.title')}</h1>
      <p className="mt-1.5 text-[13.5px] text-muted">{t('pricing.sub')}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-1 md:grid-cols-3">
        {plans.map((p) => {
          const feats: string[] =
            (locale === 'en' && p.features?.en?.length ? p.features.en : p.features?.fr) ?? []
          const hl = Boolean(p.features?.highlight)
          const months = Math.round(p.access_days / 30)
          return (
            <div
              key={p.id}
              className={`relative bg-card rounded-[18px] p-5 border ${hl ? 'border-2 border-green' : 'border-line'}`}
            >
              {hl && (
                <span className="absolute -top-2.5 left-5 bg-green text-white text-[10.5px] font-bold px-3 py-0.5 rounded-full">
                  {t('pricing.recommended')}
                </span>
              )}
              <h4 className="text-[15px] font-extrabold">{p.name}</h4>
              <div className="mono text-2xl mt-2.5">
                {p.price_bif.toLocaleString('fr-FR')}{' '}
                <small className="text-[11px] text-muted">
                  BIF · {months} {t('pricing.months')}
                </small>
              </div>
              <ul className="mt-3.5 flex flex-col gap-2 list-none p-0">
                {feats.map((f, i) => (
                  <li key={i} className="text-[12.5px] leading-snug pl-5 relative text-body">
                    <span className="absolute left-0 text-green font-bold">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button className={`btn mt-4 ${hl ? '' : 'green'}`} onClick={() => choose(p)}>
                {t('pricing.choose')}
              </button>
            </div>
          )
        })}
      </div>
    </ScreenShell>
  )
}
