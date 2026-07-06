import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Attempt, Enrollment, Payment, Plan, Profile } from '../lib/types'
import { Spinner } from '../components/ui'
import { Modal } from './Questions'
import { fmtBif, fmtDate, fmtDateTime, logAction } from './lib'

export default function UsersAdmin() {
  const [rows, setRows] = useState<Profile[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Profile | null>(null)

  async function load() {
    setLoading(true)
    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(200)
    if (q.trim()) query = query.or(`phone.ilike.%${q.trim()}%,first_name.ilike.%${q.trim()}%,last_name.ilike.%${q.trim()}%`)
    const { data } = await query
    setRows((data as Profile[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [q])

  return (
    <div>
      <h1 className="text-xl font-extrabold">Utilisateurs</h1>
      <input
        className="input !w-72 mt-4"
        placeholder="Rechercher : téléphone, nom…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {loading ? (
        <Spinner />
      ) : (
        <div className="card mt-4 !p-0 overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Nom</th><th>Téléphone</th><th>Rôle</th><th>Objectif</th><th>Inscrit le</th><th>Dernière visite</th><th></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold">{p.first_name} {p.last_name}</td>
                  <td className="mono text-[12px]">{p.phone}</td>
                  <td><span className={`pill ${p.role === 'admin' ? 'red' : p.role === 'coach' ? 'gold' : ''}`}>{p.role}</span></td>
                  <td className="text-[12px]">{p.goal ?? '—'}</td>
                  <td className="text-[12px]">{fmtDate(p.created_at)}</td>
                  <td className="text-[12px]">{fmtDateTime(p.last_seen_at)}</td>
                  <td><button className="text-green font-semibold text-[12px] bg-transparent border-0 cursor-pointer" onClick={() => setDetail(p)}>Fiche</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && <UserDetail profile={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function UserDetail({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [enrollments, setEnrollments] = useState<(Enrollment & { plan?: Plan })[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [progressCount, setProgressCount] = useState(0)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    supabase.from('enrollments').select('*, plan:plans(*)').eq('user_id', profile.id).order('created_at', { ascending: false })
      .then(({ data }) => setEnrollments((data as any) ?? []))
    supabase.from('attempts').select('*').eq('user_id', profile.id).order('started_at', { ascending: false }).limit(10)
      .then(({ data }) => setAttempts((data as unknown as Attempt[]) ?? []))
    supabase.from('payments').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
      .then(({ data }) => setPayments((data as unknown as Payment[]) ?? []))
    supabase.from('lesson_progress').select('lesson_id', { count: 'exact', head: true }).eq('user_id', profile.id).not('completed_at', 'is', null)
      .then(({ count }) => setProgressCount(count ?? 0))
  }, [profile.id, refresh])

  async function extend(e: Enrollment, days: number) {
    const base = new Date(e.expires_at) > new Date() ? new Date(e.expires_at) : new Date()
    await supabase.from('enrollments').update({
      expires_at: new Date(base.getTime() + days * 86400000).toISOString(),
      status: 'active',
    }).eq('id', e.id)
    await logAction('extend_enrollment', 'enrollments', e.id, { days })
    setRefresh((r) => r + 1)
  }

  async function suspend(e: Enrollment) {
    const to = e.status === 'suspended' ? 'active' : 'suspended'
    await supabase.from('enrollments').update({ status: to }).eq('id', e.id)
    await logAction(`${to === 'suspended' ? 'suspend' : 'reactivate'}_enrollment`, 'enrollments', e.id)
    setRefresh((r) => r + 1)
  }

  async function unlockDiagnostic() {
    await supabase.rpc('admin_unlock_diagnostic', { p_user: profile.id })
    alert('Repassage du diagnostic débloqué.')
  }

  async function setRole(role: string) {
    await supabase.from('profiles').update({ role }).eq('id', profile.id)
    await logAction('set_role', 'profiles', profile.id, { role })
    alert(`Rôle changé : ${role}`)
  }

  const diag = attempts.find((a) => a.kind === 'diagnostic' && a.finished_at)

  return (
    <Modal onClose={onClose} title={`${profile.first_name} ${profile.last_name} · ${profile.phone}`}>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="card !p-3">
          <div className="text-[11px] text-muted">Diagnostic</div>
          <div className="mono text-[18px] text-green">{diag ? `${diag.cefr} · ${diag.projected_score}/120` : '—'}</div>
        </div>
        <div className="card !p-3">
          <div className="text-[11px] text-muted">Leçons terminées</div>
          <div className="mono text-[18px] text-green">{progressCount}</div>
        </div>
        <div className="card !p-3">
          <div className="text-[11px] text-muted">Objectif · examen visé</div>
          <div className="text-[13px] font-semibold">{profile.goal ?? '—'} · {fmtDate(profile.target_exam_date)}</div>
        </div>
      </div>

      <h3 className="text-[13px] font-bold mt-4 mb-1.5">Accès (enrollments)</h3>
      {enrollments.length === 0 && <p className="text-[12px] text-muted">Aucun accès.</p>}
      {enrollments.map((e) => (
        <div key={e.id} className="flex flex-wrap items-center gap-2 border border-line rounded-[10px] px-3 py-2 mb-1.5 text-[12.5px]">
          <b>{e.plan?.name ?? e.plan_id}</b>
          <span className="text-muted">{fmtDate(e.starts_at)} → {fmtDate(e.expires_at)}</span>
          <span className={`pill ${e.status === 'active' ? '' : 'red'}`}>{e.status}</span>
          <span className="ml-auto flex gap-1.5">
            <button className="btn ghost sm" onClick={() => extend(e, 30)}>+30 j</button>
            <button className="btn ghost sm" onClick={() => suspend(e)}>{e.status === 'suspended' ? 'Réactiver' : 'Suspendre'}</button>
          </span>
        </div>
      ))}

      <h3 className="text-[13px] font-bold mt-4 mb-1.5">Paiements</h3>
      {payments.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-2 border border-line rounded-[10px] px-3 py-2 mb-1.5 text-[12.5px]">
          <span className="mono">{p.reference}</span>
          <span>{fmtBif(p.amount_bif)}</span>
          <span className="text-muted">{p.channel}</span>
          <span className={`pill ${p.status === 'verified' ? '' : p.status === 'pending' ? 'gold' : 'red'}`}>{p.status}</span>
          <span className="text-muted ml-auto">{fmtDateTime(p.created_at)}</span>
        </div>
      ))}
      {payments.length === 0 && <p className="text-[12px] text-muted">Aucun paiement.</p>}

      <h3 className="text-[13px] font-bold mt-4 mb-1.5">Actions</h3>
      <div className="flex flex-wrap gap-2">
        <button className="btn ghost sm" onClick={unlockDiagnostic}>Débloquer un repassage du diagnostic</button>
        {profile.role === 'student' && <button className="btn ghost sm" onClick={() => setRole('coach')}>Passer coach</button>}
        {profile.role === 'coach' && <button className="btn ghost sm" onClick={() => setRole('student')}>Repasser étudiant</button>}
      </div>
    </Modal>
  )
}
