import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { newPaymentReference } from '../lib/scoring'
import type { Payment as PaymentRow, Plan } from '../lib/types'
import { BrandLogo, ScreenShell, Spinner } from '../components/ui'

const POLL_MS = 15_000 // toutes les 15 s (§5.5)
const POLL_MAX_MS = 10 * 60_000 // pendant 10 min
const MANUAL_AFTER_MS = 15 * 60_000 // manual_review après 15 min

type Merchant = { label: string; code: string; ussd: string }

export default function Payment() {
  const { planId } = useParams()
  const { t, locale } = useI18n()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [plan, setPlan] = useState<Plan | null>(null)
  const [payment, setPayment] = useState<PaymentRow | null>(null)
  const [merchant, setMerchant] = useState<Merchant>({ label: 'IJAMBO', code: '40217', ussd: '*163#' })
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<'idle' | 'polling' | 'verified' | 'manual_review'>('idle')
  const pollStart = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    if (!session || !planId) return
    ;(async () => {
      const { data: p } = await supabase.from('plans').select('*').eq('id', planId).single()
      setPlan(p as unknown as Plan)
      const { data: m } = await supabase
        .from('app_settings').select('value').eq('key', 'lumicash_merchant_code').maybeSingle()
      if (m?.value) setMerchant(m.value as Merchant)

      // paiement pending existant pour ce plan → réutilisé (même référence)
      const { data: existing } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('plan_id', planId)
        .in('status', ['pending', 'manual_review', 'verified'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        const pay = existing as unknown as PaymentRow
        setPayment(pay)
        if (pay.status === 'verified') setStatus('verified')
        else if (pay.status === 'manual_review') setStatus('manual_review')
        return
      }

      const { data: created, error } = await supabase
        .from('payments')
        .insert({
          user_id: session.user.id,
          plan_id: planId,
          reference: newPaymentReference(),
          amount_bif: (p as Plan).price_bif,
          channel: 'lumicash',
          status: 'pending',
        })
        .select()
        .single()
      if (!error) setPayment(created as unknown as PaymentRow)
    })()
    return () => clearInterval(timer.current)
  }, [session, planId])

  const checkOnce = useCallback(async (): Promise<string | null> => {
    if (!payment) return null
    const { data } = await supabase.from('payments').select('status').eq('id', payment.id).single()
    return data?.status ?? null
  }, [payment])

  async function startPolling() {
    if (!payment) return
    setChecking(true)
    setStatus('polling')
    pollStart.current = Date.now()

    const tick = async () => {
      const s = await checkOnce()
      if (s === 'verified') {
        clearInterval(timer.current)
        setStatus('verified')
        setChecking(false)
        setTimeout(() => navigate('/dashboard'), 2500)
        return
      }
      if (s === 'manual_review') {
        clearInterval(timer.current)
        setStatus('manual_review')
        setChecking(false)
        return
      }
      const elapsed = Date.now() - pollStart.current
      const paymentAge = Date.now() - new Date(payment.created_at).getTime()
      if (paymentAge > MANUAL_AFTER_MS) {
        // pas de correspondance après 15 min → vérification manuelle (§5.5.5)
        clearInterval(timer.current)
        await supabase.from('payments').update({ status: 'manual_review' }).eq('id', payment.id).then(() => {})
        setStatus('manual_review')
        setChecking(false)
        return
      }
      if (elapsed > POLL_MAX_MS) {
        clearInterval(timer.current)
        setChecking(false)
        setStatus('idle')
      }
    }
    await tick()
    timer.current = setInterval(tick, POLL_MS)
  }

  if (!plan || !payment) return <Spinner />
  const months = Math.round(plan.access_days / 30)

  return (
    <ScreenShell>
      <div className="flex items-center justify-between pt-5">
        <BrandLogo size="sm" />
        <span className="pill">{plan.name.toUpperCase()}</span>
      </div>

      <div className="card mt-5 flex justify-between items-baseline">
        <div className="mono text-[26px] font-medium">
          {plan.price_bif.toLocaleString('fr-FR')} <small className="text-[12px] text-muted">BIF</small>
        </div>
        <span className="pill gold">
          {t('pay.access')} {months} {t('pricing.months')}
        </span>
      </div>

      {/* code de référence unique (§5.5.1) */}
      <div className="card mt-4 text-center">
        <p className="text-[11.5px] text-muted">{t('pay.reference')}</p>
        <div className="mono text-[28px] tracking-[6px] text-green font-medium mt-1">{payment.reference}</div>
        <p className="text-[11px] text-muted mt-1">{t('pay.reference.help')}</p>
      </div>

      {/* instructions pas-à-pas (écran 4 de la maquette) */}
      <div className="mt-4 flex flex-col gap-2.5">
        <Step n={1}>{t('pay.step1')}</Step>
        <div className="ussd">{merchant.ussd}</div>
        <Step n={2}>
          {t('pay.step2.pre')} <b>{t('pay.step2.merchant')}</b> {t('pay.step2.post')}{' '}
          <b className="mono text-green">
            {merchant.label} · {merchant.code}
          </b>
        </Step>
        <Step n={3}>
          {t('pay.step3.pre')} <b>{plan.price_bif.toLocaleString('fr-FR')} BIF</b> {t('pay.step3.post')}
        </Step>
        <Step n={4}>
          ✅ <b>{t('pay.step4')}</b>
        </Step>
      </div>

      {status === 'verified' ? (
        <div className="card mt-5 !bg-green-soft !border-green text-center">
          <p className="text-[14px] font-bold text-green">{t('pay.verified')}</p>
        </div>
      ) : status === 'manual_review' ? (
        <div className="card mt-5 !bg-gold-soft !border-gold text-center">
          <p className="text-[13px] font-semibold text-gold-ink">{t('pay.manualreview')}</p>
        </div>
      ) : (
        <>
          <button className="btn green mt-5" onClick={startPolling} disabled={checking}>
            {checking ? t('pay.verifying') : t('pay.verify')}
          </button>
          {checking && (
            <div className="progress gold mt-3">
              <i className="pulse" style={{ width: '100%' }} />
            </div>
          )}
        </>
      )}

      <p className="text-center text-[12px] text-muted mt-4">
        {t('pay.diaspora')} <b className="text-green">{t('pay.diaspora.card')}</b> {t('pay.diaspora.soon')}
      </p>
    </ScreenShell>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 items-start text-[13px] leading-snug">
      <span className="flex-none w-[18px] h-[18px] rounded-full bg-green text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <span>{children}</span>
    </div>
  )
}
