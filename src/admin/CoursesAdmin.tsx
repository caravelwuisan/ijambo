import { useEffect, useState, type DragEvent } from 'react'
import { supabase } from '../lib/supabase'
import { renderMarkdown } from '../lib/markdown'
import type { Course, Lesson, Module, Test } from '../lib/types'
import { Spinner } from '../components/ui'
import { Modal } from './Questions'
import { STATUSES, logAction } from './lib'

export default function CoursesAdmin() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selected, setSelected] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingCourse, setEditingCourse] = useState<Partial<Course> | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('courses').select('*').order('sort')
    const list = (data as Course[]) ?? []
    setCourses(list)
    setSelected((cur) => (cur ? list.find((c) => c.id === cur.id) ?? list[0] ?? null : list[0] ?? null))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function saveCourse() {
    if (!editingCourse) return
    const payload = {
      name: editingCourse.name,
      target: editingCourse.target ?? 'toefl',
      description: editingCourse.description ?? null,
      duration_weeks: editingCourse.duration_weeks ?? null,
      status: editingCourse.status ?? 'draft',
    }
    if (editingCourse.id) {
      await supabase.from('courses').update(payload).eq('id', editingCourse.id)
      await logAction('update_course', 'courses', editingCourse.id)
    } else {
      const { data } = await supabase.from('courses').insert({ ...payload, sort: courses.length }).select('id').single()
      await logAction('create_course', 'courses', data?.id)
    }
    setEditingCourse(null)
    load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Formations</h1>
        <button className="btn green sm" onClick={() => setEditingCourse({ name: '', target: 'toefl', status: 'draft' })}>
          + Nouvelle formation
        </button>
      </div>

      <div className="flex gap-2 mt-4 flex-wrap">
        {courses.map((c) => (
          <button
            key={c.id}
            className={`btn sm ${selected?.id === c.id ? 'green' : 'ghost'}`}
            onClick={() => setSelected(c)}
          >
            {c.name} {c.status !== 'published' && '· brouillon'}
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-4">
          <div className="card flex flex-wrap items-center gap-3 justify-between">
            <div>
              <b className="text-[14px]">{selected.name}</b>
              <span className="text-[12px] text-muted ml-2">
                {selected.target.toUpperCase()} · {selected.duration_weeks ?? '—'} semaines
              </span>
            </div>
            <div className="flex gap-2">
              <span className={`pill ${selected.status === 'published' ? '' : 'gold'}`}>{selected.status}</span>
              <button className="btn ghost sm" onClick={() => setEditingCourse({ ...selected })}>Éditer</button>
            </div>
          </div>
          <ModuleTree course={selected} />
        </div>
      )}

      {editingCourse && (
        <Modal onClose={() => setEditingCourse(null)} title={editingCourse.id ? 'Modifier la formation' : 'Nouvelle formation'}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="field"><span>Nom</span>
              <input className="input" value={editingCourse.name ?? ''} onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })} />
            </label>
            <label className="field"><span>Test cible</span>
              <select className="input" value={editingCourse.target} onChange={(e) => setEditingCourse({ ...editingCourse, target: e.target.value })}>
                <option value="toefl">TOEFL</option><option value="ielts">IELTS</option><option value="det">DET</option><option value="business">Anglais des affaires</option>
              </select>
            </label>
            <label className="field"><span>Durée (semaines)</span>
              <input className="input" type="number" value={editingCourse.duration_weeks ?? ''} onChange={(e) => setEditingCourse({ ...editingCourse, duration_weeks: e.target.value ? Number(e.target.value) : null })} />
            </label>
            <label className="field"><span>Statut</span>
              <select className="input" value={editingCourse.status} onChange={(e) => setEditingCourse({ ...editingCourse, status: e.target.value as Course['status'] })}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <label className="field mt-3 block"><span>Description</span>
            <textarea className="input" rows={3} value={editingCourse.description ?? ''} onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })} />
          </label>
          <div className="flex gap-2 justify-end mt-5">
            <button className="btn ghost sm" onClick={() => setEditingCourse(null)}>Annuler</button>
            <button className="btn green sm" onClick={saveCourse}>Enregistrer</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function ModuleTree({ course }: { course: Course }) {
  const [modules, setModules] = useState<Module[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [editingLesson, setEditingLesson] = useState<Partial<Lesson> | null>(null)
  const [dragged, setDragged] = useState<{ kind: 'module' | 'lesson'; id: string } | null>(null)

  async function load() {
    const { data: mods } = await supabase.from('modules').select('*').eq('course_id', course.id).order('sort')
    setModules((mods as Module[]) ?? [])
    const ids = (mods ?? []).map((m) => m.id)
    if (ids.length) {
      const { data: ls } = await supabase.from('lessons').select('*').in('module_id', ids).order('sort')
      setLessons((ls as Lesson[]) ?? [])
    } else setLessons([])
  }
  useEffect(() => { load() }, [course.id])

  async function addModule() {
    const name = prompt('Nom du module (ex. Listening)')
    if (!name) return
    await supabase.from('modules').insert({ course_id: course.id, name, sort: modules.length })
    await logAction('create_module', 'modules')
    load()
  }

  async function renameModule(m: Module) {
    const name = prompt('Nom du module', m.name)
    if (!name) return
    await supabase.from('modules').update({ name }).eq('id', m.id)
    load()
  }

  async function addLesson(moduleId: string) {
    const count = lessons.filter((l) => l.module_id === moduleId).length
    setEditingLesson({ module_id: moduleId, title: '', body_md: '', pass_threshold: 70, est_minutes: 20, sort: count, status: 'draft' })
  }

  // ---------- glisser-déposer (§6.5) ----------
  function onDropLesson(e: DragEvent, target: Lesson) {
    e.preventDefault()
    if (dragged?.kind !== 'lesson' || dragged.id === target.id) return
    const src = lessons.find((l) => l.id === dragged.id)
    if (!src) return
    const sibs = lessons.filter((l) => l.module_id === target.module_id && l.id !== src.id)
    const at = sibs.findIndex((l) => l.id === target.id)
    sibs.splice(at, 0, { ...src, module_id: target.module_id })
    Promise.all(
      sibs.map((l, i) => supabase.from('lessons').update({ sort: i, module_id: target.module_id }).eq('id', l.id)),
    ).then(load)
    setDragged(null)
  }

  function onDropModule(e: DragEvent, target: Module) {
    e.preventDefault()
    if (dragged?.kind !== 'module' || dragged.id === target.id) return
    const ordered = modules.filter((m) => m.id !== dragged.id)
    const at = ordered.findIndex((m) => m.id === target.id)
    const src = modules.find((m) => m.id === dragged.id)!
    ordered.splice(at, 0, src)
    Promise.all(ordered.map((m, i) => supabase.from('modules').update({ sort: i }).eq('id', m.id))).then(load)
    setDragged(null)
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {modules.map((m) => (
        <div
          key={m.id}
          className="card"
          draggable
          onDragStart={() => setDragged({ kind: 'module', id: m.id })}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => onDropModule(e, m)}
        >
          <div className="flex items-center justify-between">
            <b className="text-[13.5px] cursor-grab" title="Glissez pour réordonner">⠿ {m.icon} {m.name}</b>
            <div className="flex gap-2">
              <button className="text-ink text-[12px] font-semibold bg-transparent border-0 cursor-pointer" onClick={() => renameModule(m)}>Renommer</button>
              <button className="text-green text-[12px] font-semibold bg-transparent border-0 cursor-pointer" onClick={() => addLesson(m.id)}>+ leçon</button>
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {lessons.filter((l) => l.module_id === m.id).map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2 bg-paper border border-line rounded-[10px] px-3 py-2 text-[12.5px]"
                draggable
                onDragStart={(e) => {
                  e.stopPropagation()
                  setDragged({ kind: 'lesson', id: l.id })
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.stopPropagation()
                  onDropLesson(e, l)
                }}
              >
                <span className="cursor-grab text-muted">⠿</span>
                <span className="flex-1 font-semibold">{l.title}</span>
                <span className="mono text-[10.5px] text-muted">{l.est_minutes ?? '—'} min · seuil {l.pass_threshold}%</span>
                <span className={`pill ${l.status === 'published' ? '' : 'gold'}`}>{l.status}</span>
                <button className="text-ink text-[12px] font-semibold bg-transparent border-0 cursor-pointer" onClick={() => setEditingLesson({ ...l })}>Éditer</button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button className="btn ghost sm self-start" onClick={addModule}>+ module</button>

      {editingLesson && (
        <LessonEditor
          lesson={editingLesson}
          setLesson={setEditingLesson}
          onSaved={() => {
            setEditingLesson(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function LessonEditor({
  lesson,
  setLesson,
  onSaved,
}: {
  lesson: Partial<Lesson>
  setLesson: (l: Partial<Lesson> | null) => void
  onSaved: () => void
}) {
  const [quizzes, setQuizzes] = useState<Test[]>([])
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const set = (k: keyof Lesson, v: unknown) => setLesson({ ...lesson, [k]: v })

  useEffect(() => {
    supabase
      .from('tests')
      .select('id, name, kind')
      .eq('kind', 'quiz_lecon')
      .neq('status', 'archived')
      .then(({ data }) => setQuizzes((data as Test[]) ?? []))
  }, [])

  async function uploadAudio(file: File) {
    const path = `lessons/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const { error } = await supabase.storage.from('audio').upload(path, file)
    if (error) return alert(`Upload échoué : ${error.message}`)
    const { data } = supabase.storage.from('audio').getPublicUrl(path)
    set('audio_url', data.publicUrl)
  }

  async function save() {
    const payload = {
      module_id: lesson.module_id,
      title: lesson.title,
      body_md: lesson.body_md ?? null,
      audio_url: lesson.audio_url ?? null,
      quiz_test_id: lesson.quiz_test_id || null,
      pass_threshold: lesson.pass_threshold ?? 70,
      est_minutes: lesson.est_minutes ?? null,
      sort: lesson.sort ?? 0,
      status: lesson.status ?? 'draft',
    }
    if (lesson.id) {
      await supabase.from('lessons').update(payload).eq('id', lesson.id)
      await logAction('update_lesson', 'lessons', lesson.id)
    } else {
      const { data } = await supabase.from('lessons').insert(payload).select('id').single()
      await logAction('create_lesson', 'lessons', data?.id)
    }
    onSaved()
  }

  return (
    <Modal onClose={() => setLesson(null)} title={lesson.id ? 'Modifier la leçon' : 'Nouvelle leçon'}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="field md:col-span-2"><span>Titre</span>
          <input className="input" value={lesson.title ?? ''} onChange={(e) => set('title', e.target.value)} />
        </label>
        <label className="field"><span>Quiz de fin de leçon</span>
          <select className="input" value={lesson.quiz_test_id ?? ''} onChange={(e) => set('quiz_test_id', e.target.value || null)}>
            <option value="">— aucun —</option>
            {quizzes.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Seuil de validation (%)</span>
          <input className="input" type="number" min={0} max={100} value={lesson.pass_threshold ?? 70} onChange={(e) => set('pass_threshold', Number(e.target.value))} />
        </label>
        <label className="field"><span>Durée estimée (min)</span>
          <input className="input" type="number" value={lesson.est_minutes ?? ''} onChange={(e) => set('est_minutes', e.target.value ? Number(e.target.value) : null)} />
        </label>
        <label className="field"><span>Statut</span>
          <select className="input" value={lesson.status} onChange={(e) => set('status', e.target.value)}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="field md:col-span-2"><span>Audio de la leçon (MP3 mono 64 kbps)</span>
          <input className="input" type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && uploadAudio(e.target.files[0])} />
          {lesson.audio_url && <audio controls src={lesson.audio_url} className="w-full mt-1.5" />}
        </label>
      </div>

      <div className="mt-4">
        <div className="flex gap-2 mb-2">
          <button className={`btn sm ${tab === 'edit' ? 'green' : 'ghost'}`} onClick={() => setTab('edit')}>Markdown</button>
          <button className={`btn sm ${tab === 'preview' ? 'green' : 'ghost'}`} onClick={() => setTab('preview')}>Prévisualisation</button>
        </div>
        {tab === 'edit' ? (
          <textarea
            className="input mono !text-[12.5px]"
            rows={14}
            value={lesson.body_md ?? ''}
            onChange={(e) => set('body_md', e.target.value)}
            placeholder={'# Titre\n\nContenu de la leçon en **Markdown** : listes, tableaux, `code`, citations…'}
          />
        ) : (
          <div className="card lesson-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.body_md ?? '') }} />
        )}
      </div>

      <div className="flex gap-2 justify-end mt-5">
        <button className="btn ghost sm" onClick={() => setLesson(null)}>Annuler</button>
        <button className="btn green sm" onClick={save}>Enregistrer</button>
      </div>
    </Modal>
  )
}
