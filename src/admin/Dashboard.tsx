import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/ui'
import { fmtBif } from './lib'

type Stats = {
  signups_today: number
  signups_30d: number
  diags_today: number
  diags_30d: number
  conversion_30d: number
  revenue_30d: Record<string, number>
  revenue_total_30d: number
  manual_review: number
  active_students: number
  pending_corrections: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    supabase.rpc('admin_dashboard_stats').then(({ data }) => setStats(data as Stats))
  }, [])

  if (!stats) return <Spinner />

  return (
    <div>
      <h1 className="text-xl font-extrabold">Tableau de bord</h1>

      {stats.manual_review > 0 && (
        <Link to="/admin/payments" className="card mt-4 !bg-red-soft !border-red flex items-center gap-3 no-underline">
          <span className="text-xl">⚠️</span>
          <p className="text-[13px] font-bold text-red">
            {stats.manual_review} paiement(s) en vérification manuelle — traiter maintenant
          </p>
        </Link>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Kpi label="Inscriptions aujourd'hui" value={stats.signups_today} />
        <Kpi label="Inscriptions 30 j" value={stats.signups_30d} />
        <Kpi label="Diagnostics aujourd'hui" value={stats.diags_today} />
        <Kpi label="Diagnostics 30 j" value={stats.diags_30d} />
        <Kpi label="Conversion diag → paiement" value={`${stats.conversion_30d}%`} />
        <Kpi label="Étudiants actifs" value={stats.active_students} />
        <Kpi label="Revenus 30 j" value={fmtBif(stats.revenue_total_30d)} />
        <Kpi label="Corrections en attente" value={stats.pending_corrections} link="/admin/corrections" />
      </div>

      <h2 className="text-[13px] font-bold text-muted uppercase tracking-wide mt-6 mb-2">
        Revenus 30 jours par formule et canal
      </h2>
      <div className="card !p-0">
        <table className="admin-table">
          <thead><tr><th>Formule · canal</th><th>Montant</th></tr></thead>
          <tbody>
            {Object.entries(stats.revenue_30d ?? {}).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="mono">{fmtBif(v)}</td>
              </tr>
            ))}
            {!Object.keys(stats.revenue_30d ?? {}).length && (
              <tr><td colSpan={2} className="text-muted">Aucun paiement vérifié sur 30 jours.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Kpi({ label, value, link }: { label: string; value: number | string; link?: string }) {
  const inner = (
    <div className="card h-full">
      <div className="mono text-[22px] text-green font-medium">{value}</div>
      <div className="text-[11px] text-muted mt-1">{label}</div>
    </div>
  )
  return link ? <Link to={link} className="no-underline">{inner}</Link> : inner
}
