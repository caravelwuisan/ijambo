import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { Booking, CoachingSlot, Plan, Profile } from '../lib/types'
import { ScreenShell, Spinner } from '../components/ui'

type SlotRow = CoachingSlot & { coach?: Pick<Profile, 'first_name' | 'last_name'>; bookings?: { id: string; user_id: string; status: string }[] }

export default function Coaching() {
  const { t, locale } = useI18n()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [slots, setSlots] = useState<SlotRow[]>([])
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [sessionsIncluded, setSessionsIncluded] = useState(0)
  const [premiumPlan, setPremiumPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!session) return
    const [{ data: sl }, { data: bk }, { data: enr }, { data: plans }] = await Promise.all([
      supabase
        .from('coaching_slots')
        .select('*, coach:profiles!coaching_slots_coach_id_fkey(first_name, last_name), bookings(id, user_id, status)')
        .eq('status', 'open')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at'),
      supabase.from('bookings').select('*').eq('user_id', session.user.id).eq('status', 'booked'),
      supabase
        .from('enrollments')
        .select('plan:plans(coaching_sessions)')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString()),
      supabase.from('plans').select('*').eq('is_active', true).order('sort', { ascending: false }).limit(1),
    ])
    setSlots((sl as unknown as SlotRow[]) ?? [])
    setMyBookings((bk as unknown as Booking[]) ?? [])
    setSessionsIncluded(Math.max(...((enr ?? []).map((e: any) => e.plan?.coaching_sessions ?? 0)), 0))
    setPremiumPlan((plans?.[0] as unknown as Plan) ?? null)
    setLoading(false)
  }
  useEffect(() => { load() }, [session])

  const usedSessions = myBookings.length
  const left = Math.max(0, sessionsIncluded - usedSessions)
  const hasPremium = sessionsIncluded > 0
  const coach = slots[0]?.coach

  async function book(slot: SlotRow) {
    if (!session || left <= 0) return
    const { error } = await supabase.from('bookings').insert({ slot_id: slot.id, user_id: session.user.id, status: 'booked' })
    if (error) alert(error.message)
    load()
  }

  if (loading) return <Spinner />

  return (
    <ScreenShell>
      <div className="pt-5 flex items-center justify-between">
        <Link to="/dashboard" className="text-[13px] text-green font-semibold no-underline">← {t('common.back')}</Link>
        <span className="pill gold">{t('coach.pill')}</span>
      </div>

      {/* profil coach (écran 6) */}
      <div className="card mt-4 flex gap-3 items-center">
        <div className="w-12 h-12 rounded-full bg-green text-white flex items-center justify-center font-extrabold text-lg border-[3px] border-gold flex-none">
          {coach?.first_name?.charAt(0) ?? 'J'}
        </div>
        <div>
          <b className="text-[13.5px]">Coach {coach ? `${coach.first_name} ${coach.last_name.charAt(0)}.` : 'Jacques B.'}</b>
          <p className="text-[11.5px] text-muted leading-snug">
            {locale === 'fr' ? 'Coaching individuel Speaking & Writing' : 'Individual Speaking & Writing coaching'}
            <br />⭐ 4,9 · Bujumbura centre
          </p>
        </div>
      </div>

      <p className="text-[12.5px] text-muted mt-3 leading-relaxed">
        {locale === 'fr'
          ? 'Le Speaking est la section la plus difficile à travailler seul. Réservez vos sessions individuelles en présentiel, incluses dans le pack Premium.'
          : 'Speaking is the hardest section to practise alone. Book your individual in-person sessions, included in the Premium pack.'}
      </p>

      {hasPremium && (
        <div className="card mt-3 !py-2.5 flex justify-between items-center">
          <span className="text-[12.5px] font-semibold">{t('coach.sessions.left')}</span>
          <span className="mono text-[15px] text-green">{left}/{sessionsIncluded}</span>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {slots.map((s) => {
          const active = (s.bookings ?? []).filter((b) => b.status === 'booked')
          const mine = active.some((b) => b.user_id === session?.user.id)
          const full = active.length >= s.capacity
          const d = new Date(s.starts_at)
          const label = d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', hour: '2-digit', minute: '2-digit' })
          return (
            <div key={s.id} className={`flex justify-between items-center bg-card border border-line rounded-[11px] px-3 py-2.5 ${full && !mine ? 'opacity-45' : ''}`}>
              <div>
                <b className="text-[12.5px] capitalize">{label}</b>
                <br />
                <span className="text-[11px] text-muted">{s.topic ?? 'Session coaching'}</span>
              </div>
              {mine ? (
                <span className="mono text-[12px] text-green">{t('coach.booked')}</span>
              ) : full ? (
                <span className="mono text-[12px] text-muted">{t('coach.full')}</span>
              ) : hasPremium && left > 0 ? (
                <button className="mono text-[12px] text-green bg-transparent border-0 cursor-pointer font-medium" onClick={() => book(s)}>
                  {t('coach.book')}
                </button>
              ) : (
                <span className="mono text-[11px] text-muted">Premium</span>
              )}
            </div>
          )
        })}
        {!slots.length && (
          <p className="text-[13px] text-muted">
            {locale === 'fr' ? 'Aucun créneau publié pour le moment.' : 'No slots published yet.'}
          </p>
        )}
      </div>

      {!hasPremium && premiumPlan && (
        <button className="btn mt-5" onClick={() => navigate(`/pay/${premiumPlan.id}`)}>
          {t('coach.upgrade')} — {premiumPlan.price_bif.toLocaleString('fr-FR')} BIF
        </button>
      )}
      <p className="text-center text-[11.5px] text-muted mt-3">{t('coach.note')}</p>
    </ScreenShell>
  )
}
