import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Course, Plan } from '../lib/types'
import { Spinner } from '../components/ui'
import { Modal } from './Questions'
import { logAction } from './lib'

export default function SettingsAdmin() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [plans, setPlans] = useState<Plan[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPlan, setEditingPlan] = useState<Partial<Plan> | null>(null)
  const [saved, setSaved] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: s }, { data: p }, { data: c }] = await Promise.all([
      supabase.from('app_settings').select('*'),
      supabase.from('plans').select('*').order('sort'),
      supabase.from('courses').select('*').order('sort'),
    ])
    setSettings(Object.fromEntries((s ?? []).map((r: any) => [r.key, r.value])))
    setPlans((p as unknown as Plan[]) ?? [])
    setCourses((c as Course[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function saveSetting(key: string, value: unknown) {
    await supabase.from('app_settings').upsert({ key, value })
    await logAction('update_setting', 'app_settings', key)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const set = (key: string, patch: Record<string, unknown>) =>
    setSettings((s) => ({ ...s, [key]: { ...(s[key] ?? {}), ...patch } }))

  async function savePlan() {
    if (!editingPlan) return
    const payload = {
      name: editingPlan.name,
      price_bif: editingPlan.price_bif ?? 0,
      access_days: editingPlan.access_days ?? 120,
      features: editingPlan.features ?? {},
      course_ids: editingPlan.course_ids ?? [],
      exam_quota: editingPlan.exam_quota ?? 0,
      coaching_sessions: editingPlan.coaching_sessions ?? 0,
      is_active: editingPlan.is_active ?? true,
    }
    if (editingPlan.id) {
      await supabase.from('plans').update(payload).eq('id', editingPlan.id)
      await logAction('update_plan', 'plans', editingPlan.id)
    } else {
      const { data } = await supabase.from('plans').insert({ ...payload, sort: plans.length }).select('id').single()
      await logAction('create_plan', 'plans', data?.id)
    }
    setEditingPlan(null)
    load()
  }

  if (loading) return <Spinner />

  const merchant = settings.lumicash_merchant_code ?? {}
  const whatsapp = settings.whatsapp_numbers ?? {}
  const homeFr = settings.home_texts?.fr ?? {}
  const homeEn = settings.home_texts?.en ?? {}
  const live = settings.live_session_links ?? {}
  const stats = settings.home_stats ?? {}

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Paramètres</h1>
        {saved && <span className="pill">✓ Enregistré</span>}
      </div>

      {/* ---------- Formules ---------- */}
      <h2 className="text-[13px] font-bold text-muted uppercase tracking-wide mt-6 mb-2">Formules tarifaires</h2>
      <div className="flex flex-col gap-2">
        {plans.map((p) => (
          <div key={p.id} className="card flex flex-wrap items-center gap-2">
            <b className="text-[13.5px]">{p.name}</b>
            <span className="mono text-[13px] text-green">{p.price_bif.toLocaleString('fr-FR')} BIF</span>
            <span className="text-[12px] text-muted">{p.access_days} j · {p.exam_quota} tests blancs · {p.coaching_sessions} coaching</span>
            {!p.is_active && <span className="pill red">inactif</span>}
            <button className="btn ghost sm ml-auto" onClick={() => setEditingPlan(structuredClone(p))}>Éditer</button>
          </div>
        ))}
        <button className="btn ghost sm self-start" onClick={() => setEditingPlan({ name: '', price_bif: 0, access_days: 120, features: { fr: [] }, course_ids: [], exam_quota: 0, coaching_sessions: 0, is_active: true })}>
          + formule
        </button>
      </div>

      {/* ---------- Lumicash ---------- */}
      <h2 className="text-[13px] font-bold text-muted uppercase tracking-wide mt-6 mb-2">Paiement Lumicash</h2>
      <div className="card grid gap-3 md:grid-cols-3">
        <label className="field"><span>Nom marchand</span>
          <input className="input" value={merchant.label ?? ''} onChange={(e) => set('lumicash_merchant_code', { label: e.target.value })} />
        </label>
        <label className="field"><span>Code marchand</span>
          <input className="input mono" value={merchant.code ?? ''} onChange={(e) => set('lumicash_merchant_code', { code: e.target.value })} />
        </label>
        <label className="field"><span>Code USSD</span>
          <input className="input mono" value={merchant.ussd ?? ''} onChange={(e) => set('lumicash_merchant_code', { ussd: e.target.value })} />
        </label>
        <button className="btn green sm md:col-span-3 justify-self-start" onClick={() => saveSetting('lumicash_merchant_code', settings.lumicash_merchant_code)}>Enregistrer</button>
      </div>

      {/* ---------- WhatsApp ---------- */}
      <h2 className="text-[13px] font-bold text-muted uppercase tracking-wide mt-6 mb-2">Numéros WhatsApp</h2>
      <div className="card grid gap-3 md:grid-cols-2">
        <label className="field"><span>Support étudiants</span>
          <input className="input mono" value={whatsapp.support ?? ''} onChange={(e) => set('whatsapp_numbers', { support: e.target.value })} />
        </label>
        <label className="field"><span>Notifications admin</span>
          <input className="input mono" value={whatsapp.admin ?? ''} onChange={(e) => set('whatsapp_numbers', { admin: e.target.value })} />
        </label>
        <button className="btn green sm justify-self-start" onClick={() => saveSetting('whatsapp_numbers', settings.whatsapp_numbers)}>Enregistrer</button>
      </div>

      {/* ---------- Textes clés FR/EN ---------- */}
      <h2 className="text-[13px] font-bold text-muted uppercase tracking-wide mt-6 mb-2">Textes de l'accueil (FR / EN)</h2>
      <div className="card grid gap-3 md:grid-cols-2">
        <label className="field"><span>Sous-titre FR</span>
          <textarea className="input" rows={3} value={homeFr.sub ?? ''} onChange={(e) => set('home_texts', { fr: { ...homeFr, sub: e.target.value }, en: homeEn })} />
        </label>
        <label className="field"><span>Sous-titre EN</span>
          <textarea className="input" rows={3} value={homeEn.sub ?? ''} onChange={(e) => set('home_texts', { fr: homeFr, en: { ...homeEn, sub: e.target.value } })} />
        </label>
        <label className="field"><span>Compteurs accueil (questions / tests / data)</span>
          <div className="flex gap-2">
            <input className="input" value={stats.questions ?? ''} onChange={(e) => set('home_stats', { questions: e.target.value })} />
            <input className="input" value={stats.mock_tests ?? ''} onChange={(e) => set('home_stats', { mock_tests: e.target.value })} />
            <input className="input" value={stats.max_data ?? ''} onChange={(e) => set('home_stats', { max_data: e.target.value })} />
          </div>
        </label>
        <button
          className="btn green sm justify-self-start self-end"
          onClick={() => {
            saveSetting('home_texts', settings.home_texts)
            saveSetting('home_stats', settings.home_stats)
          }}
        >
          Enregistrer
        </button>
      </div>

      {/* ---------- DET + sessions live ---------- */}
      <h2 className="text-[13px] font-bold text-muted uppercase tracking-wide mt-6 mb-2">Recommandation DET & sessions live</h2>
      <div className="card grid gap-3 md:grid-cols-3">
        <label className="field"><span>Seuil DET (score TOEFL projeté)</span>
          <input className="input mono" type="number" value={settings.det_threshold ?? 60} onChange={(e) => setSettings((s) => ({ ...s, det_threshold: Number(e.target.value) }))} />
        </label>
        <label className="field"><span>Lien live Speaking</span>
          <input className="input" value={live.speaking ?? ''} onChange={(e) => set('live_session_links', { speaking: e.target.value })} placeholder="https://meet…" />
        </label>
        <label className="field"><span>Lien live Writing</span>
          <input className="input" value={live.writing ?? ''} onChange={(e) => set('live_session_links', { writing: e.target.value })} placeholder="https://meet…" />
        </label>
        <button
          className="btn green sm justify-self-start"
          onClick={() => {
            saveSetting('det_threshold', settings.det_threshold)
            saveSetting('live_session_links', settings.live_session_links)
          }}
        >
          Enregistrer
        </button>
      </div>

      {editingPlan && (
        <Modal onClose={() => setEditingPlan(null)} title={editingPlan.id ? 'Modifier la formule' : 'Nouvelle formule'}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="field"><span>Nom</span>
              <input className="input" value={editingPlan.name ?? ''} onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })} />
            </label>
            <label className="field"><span>Prix (BIF)</span>
              <input className="input mono" type="number" value={editingPlan.price_bif ?? 0} onChange={(e) => setEditingPlan({ ...editingPlan, price_bif: Number(e.target.value) })} />
            </label>
            <label className="field"><span>Durée d'accès (jours)</span>
              <input className="input" type="number" value={editingPlan.access_days ?? 120} onChange={(e) => setEditingPlan({ ...editingPlan, access_days: Number(e.target.value) })} />
            </label>
            <label className="field"><span>Quota tests blancs</span>
              <input className="input" type="number" value={editingPlan.exam_quota ?? 0} onChange={(e) => setEditingPlan({ ...editingPlan, exam_quota: Number(e.target.value) })} />
            </label>
            <label className="field"><span>Sessions coaching incluses</span>
              <input className="input" type="number" value={editingPlan.coaching_sessions ?? 0} onChange={(e) => setEditingPlan({ ...editingPlan, coaching_sessions: Number(e.target.value) })} />
            </label>
            <label className="field"><span>Actif</span>
              <select className="input" value={String(editingPlan.is_active ?? true)} onChange={(e) => setEditingPlan({ ...editingPlan, is_active: e.target.value === 'true' })}>
                <option value="true">oui</option><option value="false">non</option>
              </select>
            </label>
            <label className="field md:col-span-2"><span>Mis en avant (« Recommandé »)</span>
              <select className="input" value={String(Boolean(editingPlan.features?.highlight))} onChange={(e) => setEditingPlan({ ...editingPlan, features: { fr: [], ...editingPlan.features, highlight: e.target.value === 'true' } })}>
                <option value="false">non</option><option value="true">oui</option>
              </select>
            </label>
          </div>
          <label className="field mt-3 block"><span>Contenus inclus FR (une ligne par point)</span>
            <textarea
              className="input"
              rows={4}
              value={(editingPlan.features?.fr ?? []).join('\n')}
              onChange={(e) => setEditingPlan({ ...editingPlan, features: { ...editingPlan.features, fr: e.target.value.split('\n').filter(Boolean) } })}
            />
          </label>
          <label className="field mt-3 block"><span>Contenus inclus EN</span>
            <textarea
              className="input"
              rows={4}
              value={(editingPlan.features?.en ?? []).join('\n')}
              onChange={(e) => setEditingPlan({ ...editingPlan, features: { fr: [], ...editingPlan.features, en: e.target.value.split('\n').filter(Boolean) } })}
            />
          </label>
          <label className="field mt-3 block"><span>Formations incluses</span>
            <div className="flex flex-col gap-1.5">
              {courses.map((c) => (
                <label key={c.id} className="flex gap-2 items-center text-[13px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(editingPlan.course_ids ?? []).includes(c.id)}
                    onChange={(e) => {
                      const cur = editingPlan.course_ids ?? []
                      setEditingPlan({ ...editingPlan, course_ids: e.target.checked ? [...cur, c.id] : cur.filter((x) => x !== c.id) })
                    }}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </label>
          <div className="flex gap-2 justify-end mt-5">
            <button className="btn ghost sm" onClick={() => setEditingPlan(null)}>Annuler</button>
            <button className="btn green sm" onClick={savePlan}>Enregistrer</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
