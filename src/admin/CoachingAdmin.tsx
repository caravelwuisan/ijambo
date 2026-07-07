import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { Booking, CoachingSlot, Profile } from '../lib/types'
import { Spinner } from '../components/ui'
import { Modal } from './Questions'
import { fmtDateTime, logAction } from './lib'

type SlotRow = CoachingSlot & { coach?: Pick<Profile, 'first_name' | 'last_name'>; bookings?: (Booking & { profile?: Profile })[] }

export default function CoachingAdmin() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [slots, setSlots] = useState<SlotRow[]>([])
  const [coaches, setCoaches] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    coach_id: '',
    date: '',
    time: '17:00',
    duration_min: 60,
    capacity: 4,
    topic: '',
    repeatWeeks: 1,
  })

  async function load() {
    setLoading(true)
    let q = supabase
      .from('coaching_slots')
      .select('*, coach:profiles!coaching_slots_coach_id_fkey(first_name, last_name), bookings(*, profile:profiles(first_name, last_name, phone))')
      .order('starts_at')
      .gte('starts_at', new Date(Date.now() - 86400000).toISOString())
    if (!isAdmin && profile) q = q.eq('coach_id', profile.id)
    const { data } = await q
    setSlots((data as unknown as SlotRow[]) ?? [])
    if (isAdmin) {
      const { data: cs } = await supabase.from('profiles').select('*').in('role', ['coach', 'admin'])
      setCoaches((cs as Profile[]) ?? [])
    }
    setLoading(false)
  }
  useEffect(() => { if (profile) load() }, [profile?.id])

  // publication avec récurrence hebdomadaire (§6.7)
  async function createSlots() {
    const coachId = isAdmin ? form.coach_id || profile!.id : profile!.id
    const first = new Date(`${form.date}T${form.time}`)
    if (isNaN(first.getTime())) return alert('Date invalide')
    const rows = Array.from({ length: Math.max(1, form.repeatWeeks) }, (_, i) => ({
      coach_id: coachId,
      starts_at: new Date(first.getTime() + i * 7 * 86400000).toISOString(),
      duration_min: form.duration_min,
      capacity: form.capacity,
      topic: form.topic || null,
      status: 'open',
    }))
    await supabase.from('coaching_slots').insert(rows)
    await logAction('create_slots', 'coaching_slots', undefined, { count: rows.length })
    setCreating(false)
    load()
  }

  async function markAttendance(b: Booking, status: 'attended' | 'no_show') {
    await supabase.from('bookings').update({ status }).eq('id', b.id)
    load()
  }

  async function cancelSlot(s: SlotRow) {
    if (!confirm('Annuler ce créneau ?')) return
    await supabase.from('coaching_slots').update({ status: 'cancelled' }).eq('id', s.id)
    await logAction('cancel_slot', 'coaching_slots', s.id)
    load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Coaching présentiel</h1>
        <button className="btn green sm" onClick={() => setCreating(true)}>+ Publier des créneaux</button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {slots.map((s) => (
          <div key={s.id} className={`card ${s.status === 'cancelled' ? 'opacity-50' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-[13.5px]">{fmtDateTime(s.starts_at)}</b>
              <span className="text-[12px] text-muted">{s.duration_min} min · {s.topic ?? 'Session coaching'}</span>
              {isAdmin && s.coach && <span className="pill gold">{s.coach.first_name}</span>}
              <span className="pill">{(s.bookings ?? []).filter((b) => b.status !== 'cancelled').length}/{s.capacity}</span>
              {s.status === 'cancelled' && <span className="pill red">annulé</span>}
              {s.status !== 'cancelled' && (
                <button className="ml-auto text-red text-[12px] font-semibold bg-transparent border-0 cursor-pointer" onClick={() => cancelSlot(s)}>Annuler</button>
              )}
            </div>
            {(s.bookings ?? []).filter((b) => b.status !== 'cancelled').map((b) => (
              <div key={b.id} className="flex items-center gap-2 mt-2 text-[12.5px] border-t border-line pt-2">
                <span className="font-semibold">{b.profile?.first_name} {b.profile?.last_name}</span>
                <span className="mono text-[11px] text-muted">{b.profile?.phone}</span>
                <span className={`pill ${b.status === 'attended' ? '' : b.status === 'no_show' ? 'red' : 'gold'}`}>{b.status}</span>
                <span className="ml-auto flex gap-1.5">
                  <button className="btn ghost sm" onClick={() => markAttendance(b, 'attended')}>Présent</button>
                  <button className="btn ghost sm" onClick={() => markAttendance(b, 'no_show')}>Absent</button>
                </span>
              </div>
            ))}
          </div>
        ))}
        {!slots.length && <p className="text-[13px] text-muted">Aucun créneau à venir.</p>}
      </div>

      {creating && (
        <Modal onClose={() => setCreating(false)} title="Publier des créneaux">
          <div className="grid gap-3 md:grid-cols-2">
            {isAdmin && (
              <label className="field"><span>Coach</span>
                <select className="input" value={form.coach_id} onChange={(e) => setForm({ ...form, coach_id: e.target.value })}>
                  <option value="">— moi —</option>
                  {coaches.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </label>
            )}
            <label className="field"><span>Date du premier créneau</span>
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <label className="field"><span>Heure</span>
              <input className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </label>
            <label className="field"><span>Durée (min)</span>
              <input className="input" type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: Number(e.target.value) })} />
            </label>
            <label className="field"><span>Capacité (groupes de 4 max)</span>
              <input className="input" type="number" min={1} max={4} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
            </label>
            <label className="field"><span>Répéter chaque semaine (nb de semaines)</span>
              <input className="input" type="number" min={1} max={12} value={form.repeatWeeks} onChange={(e) => setForm({ ...form, repeatWeeks: Number(e.target.value) })} />
            </label>
            <label className="field md:col-span-2"><span>Thème (ex. Speaking · Q1–Q2 indépendantes)</span>
              <input className="input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2 justify-end mt-5">
            <button className="btn ghost sm" onClick={() => setCreating(false)}>Annuler</button>
            <button className="btn green sm" onClick={createSlots} disabled={!form.date}>Publier</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
