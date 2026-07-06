import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Payment, Plan, Profile } from '../lib/types'
import { Spinner } from '../components/ui'
import { fmtBif, fmtDateTime } from './lib'

type Row = Payment & { profile?: Profile; plan?: Plan }

export default function PaymentsAdmin() {
  const [rows, setRows] = useState<Row[]>([])
  const [filter, setFilter] = useState('manual_review')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    let q = supabase
      .from('payments')
      .select('*, profile:profiles(first_name, last_name, phone), plan:plans(name)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (filter) q = q.eq('status', filter)
    const { data } = await q
    setRows((data as unknown as Row[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filter])

  // validation/rejet manuel journalisé via RPC (audit_log, §6.6)
  async function setStatus(p: Row, status: 'verified' | 'rejected') {
    const note = prompt(`Note (${status === 'verified' ? 'validation' : 'rejet'} manuel) :`) ?? undefined
    const { error } = await supabase.rpc('admin_set_payment_status', {
      p_payment_id: p.id,
      p_status: status,
      p_note: note,
    })
    if (error) alert(error.message)
    load()
  }

  return (
    <div>
      <h1 className="text-xl font-extrabold">Paiements</h1>
      <div className="flex gap-2 mt-4 flex-wrap">
        {[
          ['manual_review', '⚠ Vérification manuelle'],
          ['pending', 'En attente'],
          ['verified', 'Vérifiés'],
          ['rejected', 'Rejetés'],
          ['expired', 'Expirés'],
          ['', 'Tous'],
        ].map(([v, label]) => (
          <button key={v} className={`btn sm ${filter === v ? 'green' : 'ghost'}`} onClick={() => setFilter(v)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="card mt-4 !p-0 overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Réf.</th><th>Étudiant</th><th>Formule</th><th>Montant</th><th>Canal</th><th>Statut</th><th>SMS brut</th><th>Créé</th><th></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="mono font-medium">{p.reference}</td>
                  <td>
                    {p.profile?.first_name} {p.profile?.last_name}
                    <div className="mono text-[11px] text-muted">{p.profile?.phone}</div>
                  </td>
                  <td>{p.plan?.name}</td>
                  <td className="mono">{fmtBif(p.amount_bif)}</td>
                  <td>{p.channel}</td>
                  <td><span className={`pill ${p.status === 'verified' ? '' : p.status === 'manual_review' ? 'red' : 'gold'}`}>{p.status}</span></td>
                  <td className="max-w-52">
                    {p.sms_raw ? <div className="text-[11px] text-muted line-clamp-3" title={p.sms_raw}>{p.sms_raw}</div> : '—'}
                  </td>
                  <td className="text-[12px]">{fmtDateTime(p.created_at)}</td>
                  <td className="whitespace-nowrap">
                    {(p.status === 'manual_review' || p.status === 'pending') && (
                      <>
                        <button className="text-green font-bold text-[12px] bg-transparent border-0 cursor-pointer" onClick={() => setStatus(p, 'verified')}>Valider</button>
                        {' · '}
                        <button className="text-red font-bold text-[12px] bg-transparent border-0 cursor-pointer" onClick={() => setStatus(p, 'rejected')}>Rejeter</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={9} className="text-muted">Aucun paiement dans ce filtre.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
