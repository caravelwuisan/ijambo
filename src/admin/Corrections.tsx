import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { Profile, Submission } from '../lib/types'
import { Spinner } from '../components/ui'
import { Modal } from './Questions'
import { fmtDateTime, logAction } from './lib'

type Row = Submission & { profile?: Profile }

export default function Corrections() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [rows, setRows] = useState<Row[]>([])
  const [coaches, setCoaches] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [grading, setGrading] = useState<Row | null>(null)
  const [score, setScore] = useState(15)
  const [feedback, setFeedback] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    let q = supabase
      .from('submissions')
      .select('*, profile:profiles!submissions_user_id_fkey(first_name, last_name, phone)')
      .order('created_at')
    if (!isAdmin && profile) q = q.eq('assigned_coach', profile.id)
    const { data } = await q
    setRows((data as unknown as Row[]) ?? [])
    if (isAdmin) {
      const { data: cs } = await supabase.from('profiles').select('*').in('role', ['coach', 'admin'])
      setCoaches((cs as Profile[]) ?? [])
    }
    setLoading(false)
  }
  useEffect(() => { if (profile) load() }, [profile?.id])

  async function openGrading(r: Row) {
    setGrading(r)
    setScore(r.score ?? 15)
    setFeedback(r.feedback ?? '')
    setAudioUrl(null)
    if (r.audio_url) {
      // bucket privé : URL signée pour le lecteur audio intégré (§6.7)
      const { data } = await supabase.storage.from('submissions').createSignedUrl(r.audio_url, 3600)
      setAudioUrl(data?.signedUrl ?? null)
    }
    if (r.status === 'queued') await supabase.from('submissions').update({ status: 'in_review' }).eq('id', r.id)
  }

  async function assign(r: Row, coachId: string) {
    await supabase.from('submissions').update({ assigned_coach: coachId || null }).eq('id', r.id)
    await logAction('assign_submission', 'submissions', r.id, { coach: coachId })
    load()
  }

  async function saveGrade() {
    if (!grading) return
    await supabase
      .from('submissions')
      .update({ score, feedback, status: 'corrected', corrected_at: new Date().toISOString() })
      .eq('id', grading.id)
    await logAction('correct_submission', 'submissions', grading.id, { score })
    setGrading(null)
    load()
  }

  if (loading) return <Spinner />

  const pending = rows.filter((r) => r.status !== 'corrected')
  const done = rows.filter((r) => r.status === 'corrected')

  return (
    <div>
      <h1 className="text-xl font-extrabold">Corrections Writing & Speaking</h1>

      <h2 className="text-[13px] font-bold text-muted uppercase tracking-wide mt-5 mb-2">File d'attente ({pending.length})</h2>
      <div className="flex flex-col gap-2">
        {pending.map((r) => (
          <div key={r.id} className="card flex flex-wrap items-center gap-2">
            <span className={`pill ${r.section === 'writing' ? 'gold' : ''}`}>{r.section.toUpperCase()}</span>
            <b className="text-[13px]">{r.profile?.first_name} {r.profile?.last_name}</b>
            <span className="text-[11.5px] text-muted">{fmtDateTime((r as any).created_at)}</span>
            {isAdmin && (
              <select className="input !w-44 !py-1.5 !text-[12px]" value={r.assigned_coach ?? ''} onChange={(e) => assign(r, e.target.value)}>
                <option value="">— assigner un coach —</option>
                {coaches.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            )}
            <button className="btn green sm ml-auto" onClick={() => openGrading(r)}>Corriger</button>
          </div>
        ))}
        {!pending.length && <p className="text-[13px] text-muted">Aucune correction en attente. 🎉</p>}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="text-[13px] font-bold text-muted uppercase tracking-wide mt-6 mb-2">Corrigées ({done.length})</h2>
          <div className="flex flex-col gap-2">
            {done.slice(0, 20).map((r) => (
              <div key={r.id} className="card !py-2.5 flex items-center gap-2 text-[12.5px]">
                <span className={`pill ${r.section === 'writing' ? 'gold' : ''}`}>{r.section}</span>
                <span>{r.profile?.first_name} {r.profile?.last_name}</span>
                <span className="mono text-green ml-auto">{r.score}/30</span>
              </div>
            ))}
          </div>
        </>
      )}

      {grading && (
        <Modal onClose={() => setGrading(null)} title={`Correction ${grading.section} — ${grading.profile?.first_name}`}>
          {grading.content && (
            <div className="card !bg-paper max-h-64 overflow-y-auto">
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{grading.content}</p>
            </div>
          )}
          {grading.audio_url &&
            (audioUrl ? <audio controls src={audioUrl} className="w-full mt-3" /> : <p className="text-[12px] text-muted mt-3">Chargement de l'audio…</p>)}

          {/* grille de notation 0–30 conforme TOEFL (§6.7) */}
          <label className="field mt-4 block">
            <span>Note /30 (grille TOEFL : 0–9 limité · 10–17 moyen · 18–25 bon · 26–30 excellent)</span>
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={30} value={score} onChange={(e) => setScore(Number(e.target.value))} className="flex-1 accent-[#1E7A46]" />
              <span className="mono text-[20px] text-green w-14 text-right">{score}/30</span>
            </div>
          </label>
          <label className="field mt-3 block"><span>Commentaire à l'étudiant</span>
            <textarea className="input" rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Points forts, axes de progression, conseils concrets…" />
          </label>
          <div className="flex gap-2 justify-end mt-4">
            <button className="btn ghost sm" onClick={() => setGrading(null)}>Annuler</button>
            <button className="btn green sm" onClick={saveGrade}>Envoyer la correction</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
