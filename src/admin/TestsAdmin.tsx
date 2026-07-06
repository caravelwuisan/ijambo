import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_SCORING } from '../lib/scoring'
import type { Question, QuestionRule, Test } from '../lib/types'
import { Spinner } from '../components/ui'
import { Modal } from './Questions'
import { SECTIONS, STATUSES, logAction } from './lib'

const EMPTY: Partial<Test> = {
  name: '',
  kind: 'quiz_lecon',
  duration_min: null,
  question_rules: [{ count: 5 }],
  question_ids: null,
  scoring: null,
  is_active: false,
  status: 'draft',
}

export default function TestsAdmin() {
  const [rows, setRows] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Test> | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('tests').select('*').order('kind').order('name')
    setRows((data as unknown as Test[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // interrupteur du diagnostic actif : bascule sans interruption (§6.3)
  async function activateDiagnostic(id: string) {
    const current = rows.find((r) => r.kind === 'diagnostic' && r.is_active)
    if (current) await supabase.from('tests').update({ is_active: false }).eq('id', current.id)
    await supabase.from('tests').update({ is_active: true, status: 'published' }).eq('id', id)
    await logAction('activate_diagnostic', 'tests', id, { previous: current?.id })
    load()
  }

  async function save() {
    if (!editing) return
    const payload = {
      name: editing.name,
      kind: editing.kind,
      duration_min: editing.duration_min || null,
      question_rules: editing.question_rules?.length ? editing.question_rules : null,
      question_ids: editing.question_ids?.length ? editing.question_ids : null,
      scoring: editing.scoring ?? null,
      status: editing.status ?? 'draft',
    }
    if (editing.id) {
      await supabase.from('tests').update(payload).eq('id', editing.id)
      await logAction('update_test', 'tests', editing.id)
    } else {
      const { data } = await supabase.from('tests').insert(payload).select('id').single()
      await logAction('create_test', 'tests', data?.id)
    }
    setEditing(null)
    load()
  }

  if (loading) return <Spinner />

  const groups: [string, string][] = [
    ['diagnostic', 'Tests diagnostics'],
    ['quiz_lecon', 'Quiz de leçons'],
    ['section_practice', 'Entraînement par section'],
  ]

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Tests & quiz</h1>
        <button className="btn green sm" onClick={() => setEditing({ ...EMPTY })}>+ Nouveau test</button>
      </div>

      {groups.map(([kind, label]) => {
        const items = rows.filter((r) => r.kind === kind)
        if (!items.length) return null
        return (
          <section key={kind} className="mt-6">
            <h2 className="text-[13px] font-bold text-muted uppercase tracking-wide mb-2">{label}</h2>
            <div className="card !p-0 overflow-x-auto">
              <table className="admin-table">
                <thead><tr><th>Nom</th><th>Durée</th><th>Questions</th><th>Statut</th><th>Actif</th><th></th></tr></thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id}>
                      <td className="font-semibold">{t.name}</td>
                      <td className="mono">{t.duration_min ? `${t.duration_min} min` : '—'}</td>
                      <td className="text-[12px] text-muted">
                        {t.question_ids?.length
                          ? `${t.question_ids.length} fixes`
                          : t.question_rules?.map((r) => `${r.count}× ${r.section ?? r.tags?.join('/') ?? 'toutes'}`).join(' + ') ?? '—'}
                      </td>
                      <td><span className={`pill ${t.status === 'published' ? '' : 'gold'}`}>{t.status}</span></td>
                      <td>
                        {t.kind === 'diagnostic' &&
                          (t.is_active ? (
                            <span className="pill">✓ ACTIF</span>
                          ) : (
                            <button className="text-green text-[12px] font-semibold bg-transparent border-0 cursor-pointer" onClick={() => activateDiagnostic(t.id)}>
                              Activer
                            </button>
                          ))}
                      </td>
                      <td>
                        <button className="text-ink font-semibold text-[12px] bg-transparent border-0 cursor-pointer" onClick={() => setEditing({ ...t })}>Éditer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      {editing && <TestEditor editing={editing} setEditing={setEditing} onSave={save} />}
    </div>
  )
}

function TestEditor({
  editing,
  setEditing,
  onSave,
}: {
  editing: Partial<Test>
  setEditing: (t: Partial<Test> | null) => void
  onSave: () => void
}) {
  const set = (k: keyof Test, v: unknown) => setEditing({ ...editing, [k]: v })
  const [mode, setMode] = useState<'rules' | 'manual'>(editing.question_ids?.length ? 'manual' : 'rules')
  const [pool, setPool] = useState<Question[]>([])
  const [scoringText, setScoringText] = useState(
    editing.scoring ? JSON.stringify(editing.scoring, null, 2) : '',
  )
  const [scoringError, setScoringError] = useState('')

  useEffect(() => {
    if (mode === 'manual')
      supabase
        .from('questions')
        .select('id, stem_fr, section, difficulty, status')
        .neq('status', 'archived')
        .order('section')
        .then(({ data }) => setPool((data as unknown as Question[]) ?? []))
  }, [mode])

  const rules = editing.question_rules ?? []
  const setRule = (i: number, patch: Partial<QuestionRule>) =>
    set('question_rules', rules.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  function applyScoring(text: string) {
    setScoringText(text)
    if (!text.trim()) {
      set('scoring', null)
      setScoringError('')
      return
    }
    try {
      set('scoring', JSON.parse(text))
      setScoringError('')
    } catch {
      setScoringError('JSON invalide — non enregistré tant que la syntaxe est incorrecte')
    }
  }

  return (
    <Modal onClose={() => setEditing(null)} title={editing.id ? 'Modifier le test' : 'Nouveau test'}>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="field md:col-span-2"><span>Nom</span>
          <input className="input" value={editing.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="field"><span>Type</span>
          <select className="input" value={editing.kind} onChange={(e) => set('kind', e.target.value)}>
            <option value="diagnostic">diagnostic</option>
            <option value="quiz_lecon">quiz_lecon</option>
            <option value="section_practice">section_practice</option>
          </select>
        </label>
        <label className="field"><span>Durée (min, vide = sans limite)</span>
          <input className="input" type="number" value={editing.duration_min ?? ''} onChange={(e) => set('duration_min', e.target.value ? Number(e.target.value) : null)} />
        </label>
        <label className="field"><span>Statut</span>
          <select className="input" value={editing.status} onChange={(e) => set('status', e.target.value)}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <button className={`btn sm ${mode === 'rules' ? 'green' : 'ghost'}`} onClick={() => setMode('rules')}>Sélection par règles</button>
        <button className={`btn sm ${mode === 'manual' ? 'green' : 'ghost'}`} onClick={() => setMode('manual')}>Sélection manuelle</button>
      </div>

      {mode === 'rules' ? (
        <div className="mt-3 flex flex-col gap-2">
          {rules.map((r, i) => (
            <div key={i} className="card flex flex-wrap gap-2 items-end !p-3">
              <label className="field"><span>Nombre</span>
                <input className="input !w-20" type="number" min={1} value={r.count} onChange={(e) => setRule(i, { count: Number(e.target.value) })} />
              </label>
              <label className="field"><span>Section</span>
                <select className="input !w-32" value={r.section ?? ''} onChange={(e) => setRule(i, { section: (e.target.value || undefined) as any })}>
                  <option value="">toutes</option>
                  {SECTIONS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="field"><span>Difficulté min–max</span>
                <div className="flex gap-1">
                  <input className="input !w-14" type="number" min={1} max={5} value={r.difficulty?.[0] ?? 1} onChange={(e) => setRule(i, { difficulty: [Number(e.target.value), r.difficulty?.[1] ?? 5] })} />
                  <input className="input !w-14" type="number" min={1} max={5} value={r.difficulty?.[1] ?? 5} onChange={(e) => setRule(i, { difficulty: [r.difficulty?.[0] ?? 1, Number(e.target.value)] })} />
                </div>
              </label>
              <label className="field flex-1 min-w-32"><span>Tags (virgules)</span>
                <input className="input" value={(r.tags ?? []).join(', ')} onChange={(e) => setRule(i, { tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) || undefined })} />
              </label>
              <button className="text-red bg-transparent border-0 cursor-pointer pb-2.5" onClick={() => set('question_rules', rules.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className="btn ghost sm self-start" onClick={() => set('question_rules', [...rules, { count: 5 }])}>+ règle</button>
          <p className="text-[11px] text-muted">Ex. : « 8 questions grammar niveau 2–4 aléatoires » = nombre 8, section grammar, difficulté 2–4.</p>
        </div>
      ) : (
        <div className="mt-3 card max-h-72 overflow-y-auto !p-3">
          {pool.map((q) => {
            const sel = (editing.question_ids ?? []).includes(q.id)
            return (
              <label key={q.id} className="flex gap-2 items-start py-1.5 border-b border-line text-[12.5px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={sel}
                  onChange={(e) => {
                    const cur = editing.question_ids ?? []
                    set('question_ids', e.target.checked ? [...cur, q.id] : cur.filter((x) => x !== q.id))
                  }}
                />
                <span className="pill flex-none">{q.section}</span>
                <span className="line-clamp-1">{q.stem_fr}</span>
              </label>
            )
          })}
          <p className="text-[11px] text-muted mt-2">{editing.question_ids?.length ?? 0} sélectionnée(s) — l'ordre suit la sélection.</p>
        </div>
      )}

      {editing.kind === 'diagnostic' && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold">Barème : score brut → CEFR → TOEFL projeté (§8)</span>
            <button className="btn ghost sm" onClick={() => applyScoring(JSON.stringify(DEFAULT_SCORING, null, 2))}>
              Charger le barème par défaut
            </button>
          </div>
          <textarea
            className="input mono !text-[11.5px] mt-2"
            rows={10}
            value={scoringText}
            onChange={(e) => applyScoring(e.target.value)}
            placeholder='{"total_points":100,"bands":[…],"det_recommendation_threshold":60}'
          />
          {scoringError && <p className="text-[11.5px] text-red font-semibold mt-1">{scoringError}</p>}
        </div>
      )}

      <div className="flex gap-2 justify-end mt-5">
        <button className="btn ghost sm" onClick={() => setEditing(null)}>Annuler</button>
        <button className="btn green sm" onClick={onSave} disabled={Boolean(scoringError)}>Enregistrer</button>
      </div>
    </Modal>
  )
}
