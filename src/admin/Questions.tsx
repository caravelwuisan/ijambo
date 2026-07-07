import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Passage, Question } from '../lib/types'
import QuestionCard from '../components/QuestionCard'
import { Spinner } from '../components/ui'
import { QUESTION_TYPES, SECTIONS, STATUSES, download, logAction, parseCsv, toCsv } from './lib'

const EMPTY: Partial<Question> = {
  type: 'qcm',
  section: 'grammar',
  difficulty: 2,
  stem_fr: '',
  stem_en: '',
  options: ['', '', '', ''],
  correct: [],
  explanation_fr: '',
  explanation_en: '',
  weight: 1,
  tags: [],
  status: 'draft',
}

export default function Questions() {
  const [rows, setRows] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ section: '', status: '', q: '' })
  const [editing, setEditing] = useState<Partial<Question> | null>(null)
  const [preview, setPreview] = useState<Question | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('questions')
      .select('*, passage:passages(*)')
      .order('created_at', { ascending: false })
      .limit(500)
    setRows((data as unknown as Question[]) ?? [])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!filter.section || r.section === filter.section) &&
          (!filter.status || r.status === filter.status) &&
          (!filter.q ||
            r.stem_fr.toLowerCase().includes(filter.q.toLowerCase()) ||
            r.tags.some((t) => t.includes(filter.q.toLowerCase()))),
      ),
    [rows, filter],
  )

  async function save() {
    if (!editing) return
    const payload = {
      type: editing.type,
      section: editing.section,
      difficulty: editing.difficulty,
      stem_fr: editing.stem_fr,
      stem_en: editing.stem_en || null,
      audio_url: editing.audio_url || null,
      passage_id: editing.passage_id || null,
      options: (editing.options ?? []).filter((o) => o !== ''),
      correct: editing.correct ?? [],
      explanation_fr: editing.explanation_fr || null,
      explanation_en: editing.explanation_en || null,
      weight: editing.weight ?? 1,
      tags: editing.tags ?? [],
      status: editing.status ?? 'draft',
    }
    if (editing.id) {
      await supabase.from('questions').update(payload).eq('id', editing.id)
      await logAction('update_question', 'questions', editing.id)
    } else {
      const { data } = await supabase.from('questions').insert(payload).select('id').single()
      await logAction('create_question', 'questions', data?.id)
    }
    setEditing(null)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Archiver cette question ?')) return
    await supabase.from('questions').update({ status: 'archived' }).eq('id', id)
    await logAction('archive_question', 'questions', id)
    load()
  }

  // ---------- Import JSON (annexe A) / CSV ----------
  async function importFile(file: File) {
    const text = await file.text()
    let items: any[] = []
    try {
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text)
        items = parsed.questions ?? (Array.isArray(parsed) ? parsed : [])
      } else {
        items = parseCsv(text).map((r) => ({
          ...r,
          difficulty: Number(r.difficulty || 1),
          weight: Number(r.weight || 1),
          options: r.options ? JSON.parse(r.options) : [],
          correct: r.correct ? JSON.parse(r.correct) : [],
          tags: r.tags ? r.tags.split('|').filter(Boolean) : [],
          passage: r.passage_title ? { title: r.passage_title, body: r.passage_body } : undefined,
        }))
      }
    } catch (e) {
      alert(`Fichier invalide : ${e}`)
      return
    }

    let ok = 0
    const passageCache = new Map<string, string>()
    for (const it of items) {
      let passage_id: string | null = null
      const p = it.passage ?? it.audio_script
      const ref = it.passage_ref ?? it.audio_script_ref
      if (p?.title) {
        if (!passageCache.has(p.title)) {
          const { data: existing } = await supabase.from('passages').select('id').eq('title', p.title).maybeSingle()
          if (existing) passageCache.set(p.title, existing.id)
          else {
            const { data: created } = await supabase
              .from('passages')
              .insert({ title: p.title, body: p.body ?? p.text ?? '' })
              .select('id')
              .single()
            if (created) passageCache.set(p.title, created.id)
          }
        }
        passage_id = passageCache.get(p.title) ?? null
      } else if (ref && passageCache.has(ref)) {
        passage_id = passageCache.get(ref)!
      } else if (ref) {
        const { data: existing } = await supabase.from('passages').select('id').eq('title', ref).maybeSingle()
        if (existing) {
          passageCache.set(ref, existing.id)
          passage_id = existing.id
        }
      }
      const { error } = await supabase.from('questions').insert({
        type: it.type ?? 'qcm',
        section: it.section ?? 'grammar',
        difficulty: it.difficulty ?? 1,
        stem_fr: it.stem_fr ?? '',
        stem_en: it.stem_en ?? null,
        passage_id,
        options: it.options ?? [],
        correct: it.correct ?? [],
        explanation_fr: it.explanation_fr ?? null,
        explanation_en: it.explanation_en ?? null,
        weight: it.weight ?? 1,
        scoring_map: it.scoring_map ?? null,
        tags: it.tags ?? [],
        status: 'draft',
      })
      if (!error) ok++
    }
    await logAction('import_questions', 'questions', undefined, { count: ok, file: file.name })
    alert(`${ok}/${items.length} questions importées (statut brouillon).`)
    load()
  }

  function exportJson() {
    const payload = {
      questions: filtered.map((q) => ({
        type: q.type,
        section: q.section,
        difficulty: q.difficulty,
        ...(q.passage ? { passage: { title: q.passage.title, body: q.passage.body } } : {}),
        stem_fr: q.stem_fr,
        stem_en: q.stem_en,
        options: q.options,
        correct: q.correct,
        explanation_fr: q.explanation_fr,
        explanation_en: q.explanation_en,
        weight: q.weight,
        tags: q.tags,
      })),
    }
    download('questions-ijambo.json', JSON.stringify(payload, null, 2), 'application/json')
  }

  function exportCsv() {
    const cols = ['type', 'section', 'difficulty', 'stem_fr', 'stem_en', 'options', 'correct', 'explanation_fr', 'explanation_en', 'weight', 'tags', 'passage_title', 'passage_body']
    const data = filtered.map((q) => ({
      ...q,
      options: JSON.stringify(q.options),
      correct: JSON.stringify(q.correct),
      tags: q.tags.join('|'),
      passage_title: q.passage?.title ?? '',
      passage_body: q.passage?.body ?? '',
    }))
    download('questions-ijambo.csv', toCsv(data, cols), 'text/csv')
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">Banque de questions</h1>
        <div className="flex gap-2">
          <button className="btn ghost sm" onClick={() => fileRef.current?.click()}>Importer JSON/CSV</button>
          <button className="btn ghost sm" onClick={exportJson}>Export JSON</button>
          <button className="btn ghost sm" onClick={exportCsv}>Export CSV</button>
          <button className="btn green sm" onClick={() => setEditing({ ...EMPTY })}>+ Nouvelle question</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv"
          hidden
          onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
        />
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <input
          className="input !w-56"
          placeholder="Rechercher (énoncé, tag)…"
          value={filter.q}
          onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
        />
        <select className="input !w-40" value={filter.section} onChange={(e) => setFilter((f) => ({ ...f, section: e.target.value }))}>
          <option value="">Toutes sections</option>
          {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input !w-40" value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
          <option value="">Tous statuts</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-[12px] text-muted self-center">{filtered.length} question(s)</span>
      </div>

      <div className="card mt-4 !p-0 overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr><th>Énoncé</th><th>Section</th><th>Type</th><th>Niv.</th><th>Poids</th><th>Tags</th><th>Statut</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((q) => (
              <tr key={q.id}>
                <td className="max-w-72"><div className="line-clamp-2">{q.stem_fr}</div></td>
                <td><span className="pill">{q.section}</span></td>
                <td className="mono text-[11px]">{q.type}</td>
                <td className="mono">{q.difficulty}</td>
                <td className="mono">{q.weight}</td>
                <td className="max-w-40 text-[11px] text-muted">{q.tags.slice(0, 3).join(', ')}</td>
                <td>
                  <span className={`pill ${q.status === 'published' ? '' : q.status === 'draft' ? 'gold' : 'red'}`}>{q.status}</span>
                </td>
                <td className="whitespace-nowrap">
                  <button className="text-green font-semibold text-[12px] bg-transparent border-0 cursor-pointer" onClick={() => setPreview(q)}>Aperçu</button>
                  {' · '}
                  <button className="text-ink font-semibold text-[12px] bg-transparent border-0 cursor-pointer" onClick={() => setEditing({ ...q })}>Éditer</button>
                  {' · '}
                  <button className="text-red font-semibold text-[12px] bg-transparent border-0 cursor-pointer" onClick={() => remove(q.id)}>Archiver</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <Editor editing={editing} setEditing={setEditing} onSave={save} />}

      {preview && (
        <Modal onClose={() => setPreview(null)} title="Prévisualisation — rendu étudiant">
          <div className="max-w-sm mx-auto bg-paper rounded-2xl p-4 border border-line">
            <QuestionCard question={preview} answer={preview.correct as number[]} onAnswer={() => {}} showExplanation />
          </div>
        </Modal>
      )}
    </div>
  )
}

function Editor({
  editing,
  setEditing,
  onSave,
}: {
  editing: Partial<Question>
  setEditing: (q: Partial<Question> | null) => void
  onSave: () => void
}) {
  const [passages, setPassages] = useState<Passage[]>([])
  useEffect(() => {
    supabase.from('passages').select('*').order('title').then(({ data }) => setPassages((data as Passage[]) ?? []))
  }, [])

  const set = (k: keyof Question, v: unknown) => setEditing({ ...editing, [k]: v })
  const opts = editing.options ?? []

  async function uploadAudio(file: File) {
    const path = `questions/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const { error } = await supabase.storage.from('audio').upload(path, file)
    if (error) {
      alert(`Upload échoué : ${error.message}`)
      return
    }
    const { data } = supabase.storage.from('audio').getPublicUrl(path)
    set('audio_url', data.publicUrl)
  }

  return (
    <Modal onClose={() => setEditing(null)} title={editing.id ? 'Modifier la question' : 'Nouvelle question'}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="field"><span>Type</span>
          <select className="input" value={editing.type} onChange={(e) => set('type', e.target.value)}>
            {QUESTION_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="field"><span>Section</span>
          <select className="input" value={editing.section} onChange={(e) => set('section', e.target.value)}>
            {SECTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="field"><span>Difficulté (1–5)</span>
          <input className="input" type="number" min={1} max={5} value={editing.difficulty ?? 1} onChange={(e) => set('difficulty', Number(e.target.value))} />
        </label>
        <label className="field"><span>Pondération</span>
          <input className="input" type="number" step="0.5" value={editing.weight ?? 1} onChange={(e) => set('weight', Number(e.target.value))} />
        </label>
      </div>
      <label className="field mt-3 block"><span>Énoncé FR</span>
        <textarea className="input" rows={2} value={editing.stem_fr ?? ''} onChange={(e) => set('stem_fr', e.target.value)} />
      </label>
      <label className="field mt-3 block"><span>Énoncé EN</span>
        <textarea className="input" rows={2} value={editing.stem_en ?? ''} onChange={(e) => set('stem_en', e.target.value)} />
      </label>

      <div className="grid gap-3 md:grid-cols-2 mt-3">
        <label className="field"><span>Passage / script associé</span>
          <select className="input" value={editing.passage_id ?? ''} onChange={(e) => set('passage_id', e.target.value || null)}>
            <option value="">— aucun —</option>
            {passages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </label>
        <label className="field"><span>Audio (MP3 mono 64 kbps recommandé)</span>
          <input className="input" type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && uploadAudio(e.target.files[0])} />
          {editing.audio_url && <audio controls src={editing.audio_url} className="w-full mt-1.5" />}
        </label>
      </div>

      <div className="mt-3">
        <span className="text-[12px] font-semibold block mb-1.5">Options — cochez la/les bonne(s) réponse(s)</span>
        {opts.map((o, i) => (
          <div key={i} className="flex gap-2 items-center mb-2">
            <input
              type="checkbox"
              checked={(editing.correct ?? []).includes(i)}
              onChange={(e) => {
                const cur = new Set(editing.correct ?? [])
                e.target.checked ? cur.add(i) : cur.delete(i)
                set('correct', [...cur].sort())
              }}
            />
            <input
              className="input"
              value={o}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              onChange={(e) => set('options', opts.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <button className="text-red bg-transparent border-0 cursor-pointer" onClick={() => set('options', opts.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn ghost sm" onClick={() => set('options', [...opts, ''])}>+ option</button>
        <p className="text-[11px] text-muted mt-1">Auto-évaluation : ne cochez aucune bonne réponse.</p>
      </div>

      <label className="field mt-3 block"><span>Explication FR</span>
        <textarea className="input" rows={2} value={editing.explanation_fr ?? ''} onChange={(e) => set('explanation_fr', e.target.value)} />
      </label>
      <label className="field mt-3 block"><span>Explication EN</span>
        <textarea className="input" rows={2} value={editing.explanation_en ?? ''} onChange={(e) => set('explanation_en', e.target.value)} />
      </label>

      <div className="grid gap-3 md:grid-cols-2 mt-3">
        <label className="field"><span>Tags (séparés par des virgules)</span>
          <input
            className="input"
            value={(editing.tags ?? []).join(', ')}
            onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
          />
        </label>
        <label className="field"><span>Statut</span>
          <select className="input" value={editing.status} onChange={(e) => set('status', e.target.value)}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="flex gap-2 justify-end mt-5">
        <button className="btn ghost sm" onClick={() => setEditing(null)}>Annuler</button>
        <button className="btn green sm" onClick={onSave}>Enregistrer</button>
      </div>
    </Modal>
  )
}

export function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-line w-full max-w-2xl p-5 my-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-extrabold text-[16px]">{title}</h2>
          <button className="text-muted bg-transparent border-0 cursor-pointer text-lg" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
