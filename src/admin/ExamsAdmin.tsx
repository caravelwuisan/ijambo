import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Exam, ExamSection } from '../lib/types'
import { Spinner } from '../components/ui'
import { Modal } from './Questions'
import { SECTIONS, STATUSES, logAction } from './lib'

const EMPTY_SECTION: ExamSection = { name: 'Reading', duration_min: 35, rules: [{ section: 'reading', count: 8 }], order: 0 }

export default function ExamsAdmin() {
  const [rows, setRows] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Exam> | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('exams').select('*').order('name')
    setRows((data as unknown as Exam[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    const payload = {
      name: editing.name,
      target: editing.target ?? 'toefl',
      sections: (editing.sections ?? []).map((s, i) => ({ ...s, order: i })),
      status: editing.status ?? 'draft',
    }
    if (editing.id) {
      await supabase.from('exams').update(payload).eq('id', editing.id)
      await logAction('update_exam', 'exams', editing.id)
    } else {
      const { data } = await supabase.from('exams').insert(payload).select('id').single()
      await logAction('create_exam', 'exams', data?.id)
    }
    setEditing(null)
    load()
  }

  // duplication en un clic pour créer des variantes (§6.4)
  async function duplicate(exam: Exam) {
    const { data } = await supabase
      .from('exams')
      .insert({ name: `${exam.name} (copie)`, target: exam.target, sections: exam.sections, status: 'draft' })
      .select('id')
      .single()
    await logAction('duplicate_exam', 'exams', data?.id, { from: exam.id })
    load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Examens blancs</h1>
        <button className="btn green sm" onClick={() => setEditing({ name: '', target: 'toefl', sections: [{ ...EMPTY_SECTION }], status: 'draft' })}>
          + Nouvel examen
        </button>
      </div>

      <div className="card mt-4 !p-0 overflow-x-auto">
        <table className="admin-table">
          <thead><tr><th>Nom</th><th>Cible</th><th>Sections</th><th>Durée totale</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="font-semibold">{e.name}</td>
                <td><span className="pill gold">{e.target.toUpperCase()}</span></td>
                <td className="text-[12px] text-muted">{e.sections.map((s) => s.name).join(' → ')}</td>
                <td className="mono">{e.sections.reduce((a, s) => a + (s.duration_min || 0), 0)} min</td>
                <td><span className={`pill ${e.status === 'published' ? '' : 'gold'}`}>{e.status}</span></td>
                <td className="whitespace-nowrap">
                  <button className="text-ink font-semibold text-[12px] bg-transparent border-0 cursor-pointer" onClick={() => setEditing(structuredClone(e))}>Éditer</button>
                  {' · '}
                  <button className="text-green font-semibold text-[12px] bg-transparent border-0 cursor-pointer" onClick={() => duplicate(e)}>Dupliquer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? "Modifier l'examen" : 'Nouvel examen'}>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="field md:col-span-2"><span>Nom</span>
              <input className="input" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label className="field"><span>Test cible</span>
              <select className="input" value={editing.target} onChange={(e) => setEditing({ ...editing, target: e.target.value as Exam['target'] })}>
                <option value="toefl">TOEFL</option>
                <option value="ielts">IELTS</option>
                <option value="det">Duolingo (DET)</option>
              </select>
            </label>
            <label className="field"><span>Statut</span>
              <select className="input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as Exam['status'] })}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>

          <h3 className="text-[13px] font-bold mt-4 mb-2">Sections ordonnées (minuteur + consignes par section)</h3>
          <div className="flex flex-col gap-3">
            {(editing.sections ?? []).map((s, i) => (
              <div key={i} className="card !p-3">
                <div className="flex flex-wrap gap-2 items-end">
                  <label className="field"><span>Nom</span>
                    <input className="input !w-32" value={s.name} onChange={(e) => patchSection(i, { name: e.target.value })} />
                  </label>
                  <label className="field"><span>Durée (min)</span>
                    <input className="input !w-24" type="number" value={s.duration_min} onChange={(e) => patchSection(i, { duration_min: Number(e.target.value) })} />
                  </label>
                  <label className="field"><span>Règle : nombre</span>
                    <input className="input !w-20" type="number" value={s.rules?.[0]?.count ?? 5} onChange={(e) => patchSection(i, { rules: [{ ...(s.rules?.[0] ?? { count: 5 }), count: Number(e.target.value) }] })} />
                  </label>
                  <label className="field"><span>Section questions</span>
                    <select className="input !w-32" value={s.rules?.[0]?.section ?? ''} onChange={(e) => patchSection(i, { rules: [{ ...(s.rules?.[0] ?? { count: 5 }), section: (e.target.value || undefined) as any }] })}>
                      <option value="">toutes</option>
                      {SECTIONS.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </label>
                  <div className="ml-auto flex gap-1">
                    <button className="btn ghost sm !px-2" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button className="btn ghost sm !px-2" disabled={i === (editing.sections?.length ?? 0) - 1} onClick={() => move(i, 1)}>↓</button>
                    <button className="btn ghost sm !px-2 !text-red !border-red" onClick={() => setEditing({ ...editing, sections: editing.sections!.filter((_, j) => j !== i) })}>✕</button>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2 mt-2">
                  <label className="field"><span>Consigne d'intersection FR</span>
                    <input className="input" value={s.instructions_fr ?? ''} onChange={(e) => patchSection(i, { instructions_fr: e.target.value })} />
                  </label>
                  <label className="field"><span>Consigne EN</span>
                    <input className="input" value={s.instructions_en ?? ''} onChange={(e) => patchSection(i, { instructions_en: e.target.value })} />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button
            className="btn ghost sm mt-3"
            onClick={() => setEditing({ ...editing, sections: [...(editing.sections ?? []), { ...EMPTY_SECTION, order: editing.sections?.length ?? 0 }] })}
          >
            + section
          </button>
          <p className="text-[11px] text-muted mt-2">
            L'accès aux examens et le nombre de passations se règlent dans les formules (Paramètres → quota d'examens par plan).
          </p>

          <div className="flex gap-2 justify-end mt-5">
            <button className="btn ghost sm" onClick={() => setEditing(null)}>Annuler</button>
            <button className="btn green sm" onClick={save}>Enregistrer</button>
          </div>
        </Modal>
      )}
    </div>
  )

  function patchSection(i: number, patch: Partial<ExamSection>) {
    setEditing((cur) => cur && { ...cur, sections: cur.sections!.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  }
  function move(i: number, dir: -1 | 1) {
    setEditing((cur) => {
      if (!cur?.sections) return cur
      const s = [...cur.sections]
      ;[s[i], s[i + dir]] = [s[i + dir], s[i]]
      return { ...cur, sections: s }
    })
  }
}
