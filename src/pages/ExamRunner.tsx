import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { pickLang, useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { resolveRule } from '../lib/questions'
import { isCorrect } from '../lib/scoring'
import type { Attempt, Exam, ExamSection, Question } from '../lib/types'
import QuestionCard from '../components/QuestionCard'
import { ScreenShell, Spinner } from '../components/ui'

type Phase = 'loading' | 'intro' | 'section' | 'pause' | 'report'

export default function ExamRunner() {
  const { examId } = useParams()
  const { t, locale } = useI18n()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [exam, setExam] = useState<Exam | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [sectionIdx, setSectionIdx] = useState(0)
  const [questions, setQuestions] = useState<Question[]>([])
  const [qIdx, setQIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number[]>>({})
  const [essay, setEssay] = useState('')
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const [endsAt, setEndsAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [sectionScores, setSectionScores] = useState<Record<string, number>>({})
  const advancing = useRef(false)

  useEffect(() => {
    if (!examId) return
    supabase.from('exams').select('*').eq('id', examId).single().then(({ data }) => {
      const e = data as unknown as Exam
      if (e) e.sections = [...e.sections].sort((a, b) => a.order - b.order)
      setExam(e)
      setPhase('intro')
    })
  }, [examId])

  useEffect(() => {
    if (phase !== 'section') return
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [phase])

  const section: ExamSection | undefined = exam?.sections[sectionIdx]
  const remaining = Math.max(0, Math.floor((endsAt - now) / 1000))
  const isWriting = section?.name.toLowerCase().includes('writing')
  const isSpeaking = section?.name.toLowerCase().includes('speaking')

  const loadSection = useCallback(
    async (i: number, att: Attempt) => {
      const s = exam!.sections[i]
      let qs: Question[] = []
      if (s.question_ids?.length) {
        const { data } = await supabase.from('questions').select('*, passage:passages(*)').in('id', s.question_ids)
        qs = (data as unknown as Question[]) ?? []
      } else {
        for (const r of s.rules ?? []) qs.push(...(await resolveRule(r, `${att.id}-${i}`)))
      }
      setQuestions(qs)
      setQIdx(0)
      setEssay('')
      setAudioBlob(null)
      setEndsAt(Date.now() + s.duration_min * 60000)
      setPhase('section')
    },
    [exam],
  )

  async function start() {
    if (!session || !exam) return
    setPhase('loading')
    const { data } = await supabase
      .from('attempts')
      .insert({ user_id: session.user.id, exam_id: exam.id, kind: 'exam', answers: {} })
      .select()
      .single()
    const att = data as unknown as Attempt
    setAttempt(att)
    await loadSection(0, att)
  }

  const finishSection = useCallback(async () => {
    if (advancing.current || !attempt || !exam || !section) return
    advancing.current = true

    const newScores = { ...sectionScores }
    if (isWriting || isSpeaking) {
      // envoi en file de correction pour le coach (§5.8)
      let audioPath: string | null = null
      if (isSpeaking && audioBlob && session) {
        audioPath = `${session.user.id}/${attempt.id}-speaking.webm`
        await supabase.storage.from('submissions').upload(audioPath, audioBlob, { upsert: true })
      }
      await supabase.from('submissions').insert({
        user_id: session!.user.id,
        attempt_id: attempt.id,
        section: isWriting ? 'writing' : 'speaking',
        content: isWriting ? essay : null,
        audio_url: audioPath,
        status: 'queued',
      })
    } else {
      const good = questions.filter((q) => isCorrect(q, answers[q.id])).length
      newScores[section.name.toLowerCase()] = questions.length ? Math.round((good / questions.length) * 100) : 0
      setSectionScores(newScores)
    }

    const isLast = sectionIdx >= exam.sections.length - 1
    if (isLast) {
      const auto = Object.values(newScores)
      const raw = auto.length ? Math.round(auto.reduce((a, b) => a + b, 0) / auto.length) : null
      await supabase
        .from('attempts')
        .update({ finished_at: new Date().toISOString(), answers, raw_score: raw, section_scores: newScores })
        .eq('id', attempt.id)
      setPhase('report')
    } else {
      setPhase('pause') // pause conforme au format du test (§5.8)
    }
    advancing.current = false
  }, [attempt, exam, section, sectionIdx, sectionScores, questions, answers, essay, audioBlob, isWriting, isSpeaking, session])

  useEffect(() => {
    if (phase === 'section' && remaining === 0 && endsAt > 0) finishSection()
  }, [phase, remaining, endsAt, finishSection])

  async function nextSection() {
    if (!attempt) return
    const n = sectionIdx + 1
    setSectionIdx(n)
    setPhase('loading')
    await loadSection(n, attempt)
  }

  async function toggleRecording() {
    if (recording) {
      recorder.current?.stop()
      setRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      const chunks: Blob[] = []
      mr.ondataavailable = (e) => chunks.push(e.data)
      mr.onstop = () => {
        setAudioBlob(new Blob(chunks, { type: 'audio/webm' }))
        stream.getTracks().forEach((t) => t.stop())
      }
      mr.start()
      recorder.current = mr
      setRecording(true)
    } catch {
      alert(locale === 'fr' ? 'Micro non disponible' : 'Microphone unavailable')
    }
  }

  if (phase === 'loading' || !exam) return <Spinner />

  if (phase === 'intro')
    return (
      <ScreenShell>
        <div className="pt-5">
          <Link to="/exams" className="text-[13px] text-green font-semibold no-underline">← {t('common.back')}</Link>
        </div>
        <h1 className="mt-4 text-[20px] font-extrabold">{exam.name}</h1>
        <div className="card mt-4 flex flex-col gap-2.5">
          {exam.sections.map((s, i) => (
            <div key={i} className="flex items-center gap-2.5 text-[13px]">
              <span className="mono text-[11px] text-muted w-5">{i + 1}.</span>
              <b>{s.name}</b>
              <span className="mono text-[12px] text-green ml-auto">{s.duration_min} min</span>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-muted mt-3">
          {locale === 'fr'
            ? 'Conditions réelles : chaque section est chronométrée, avec une pause entre les sections. Ne quittez pas la page pendant une section.'
            : 'Real conditions: each section is timed, with a break between sections. Do not leave the page during a section.'}
        </p>
        <button className="btn mt-5" onClick={start}>{t('exam.start')}</button>
      </ScreenShell>
    )

  if (phase === 'pause')
    return (
      <ScreenShell>
        <div className="pt-20 text-center">
          <span className="text-4xl">☕</span>
          <h1 className="mt-4 text-[20px] font-extrabold">{t('exam.pause')}</h1>
          <p className="text-[13px] text-muted mt-2">{t('exam.pause.msg')}</p>
          <p className="text-[12.5px] font-semibold mt-4">
            {locale === 'fr' ? 'Section suivante' : 'Next section'} : {exam.sections[sectionIdx + 1]?.name} ·{' '}
            {exam.sections[sectionIdx + 1]?.duration_min} min
          </p>
          <button className="btn green mt-6" onClick={nextSection}>{t('exam.continue')}</button>
        </div>
      </ScreenShell>
    )

  if (phase === 'report') {
    const entries = Object.entries(sectionScores)
    return (
      <ScreenShell>
        <div className="pt-8 text-center">
          <span className="text-4xl">📊</span>
          <h1 className="mt-3 text-[20px] font-extrabold">{t('exam.report')}</h1>
        </div>
        <div className="card mt-5 flex flex-col gap-3">
          {entries.map(([name, pct]) => (
            <div key={name}>
              <div className="flex justify-between text-[12.5px] mb-1">
                <b className="capitalize">{name}</b>
                <span className="mono text-green">{pct}%</span>
              </div>
              <div className="progress"><i style={{ width: `${pct}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="card mt-3 !bg-gold-soft !border-gold">
          <p className="text-[12.5px] text-gold-ink leading-relaxed">✍️ {t('exam.pending.ws')}</p>
        </div>
        <button className="btn mt-5" onClick={() => navigate('/exams')}>{t('common.back')}</button>
      </ScreenShell>
    )
  }

  // ---------- section en cours ----------
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const instructions = section && (locale === 'en' ? section.instructions_en || section.instructions_fr : section.instructions_fr)

  return (
    <ScreenShell>
      <div className="flex justify-between items-center pt-5 mono text-[12px] text-muted">
        <span>
          {t('exam.section')} {sectionIdx + 1}/{exam.sections.length} — {section?.name.toUpperCase()}
        </span>
        <span className={remaining < 120 ? 'text-red font-medium' : ''}>⏱ {mm}:{ss}</span>
      </div>
      <div className="progress mt-2.5">
        <i style={{ width: `${section ? Math.round((1 - remaining / (section.duration_min * 60)) * 100) : 0}%` }} />
      </div>

      {instructions && qIdx === 0 && !isWriting && !isSpeaking && (
        <p className="text-[12px] text-muted mt-3 italic">{instructions}</p>
      )}

      {isWriting ? (
        <div className="mt-4">
          {questions[0] && <p className="text-[14px] font-semibold leading-snug mb-3">{pickLang(questions[0], 'stem', locale)}</p>}
          {instructions && <p className="text-[12px] text-muted mb-3 italic">{instructions}</p>}
          <textarea
            className="input !min-h-64"
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
            placeholder={locale === 'fr' ? 'Rédigez votre essai ici (≈300 mots)…' : 'Write your essay here (≈300 words)…'}
          />
          <p className="mono text-[11px] text-muted mt-1 text-right">{essay.trim().split(/\s+/).filter(Boolean).length} mots</p>
          <button className="btn green mt-4" onClick={finishSection} disabled={!essay.trim()}>
            {t('diag.finish')}
          </button>
        </div>
      ) : isSpeaking ? (
        <div className="mt-4 text-center">
          {questions[0] && <p className="text-[14px] font-semibold leading-snug mb-3 text-left">{pickLang(questions[0], 'stem', locale)}</p>}
          {instructions && <p className="text-[12px] text-muted mb-4 italic">{instructions}</p>}
          <button
            className={`w-24 h-24 rounded-full border-4 text-3xl cursor-pointer ${recording ? 'bg-red border-red text-white pulse' : 'bg-card border-green'}`}
            onClick={toggleRecording}
          >
            {recording ? '⏹' : '🎙'}
          </button>
          <p className="text-[12px] text-muted mt-3">
            {recording
              ? locale === 'fr' ? 'Enregistrement… touchez pour arrêter' : 'Recording… tap to stop'
              : audioBlob
                ? locale === 'fr' ? '✓ Enregistré — vous pouvez recommencer' : '✓ Recorded — you can retry'
                : locale === 'fr' ? 'Touchez pour enregistrer (45 s)' : 'Tap to record (45 s)'}
          </p>
          {audioBlob && <audio controls src={URL.createObjectURL(audioBlob)} className="w-full mt-3" />}
          <button className="btn green mt-5" onClick={finishSection} disabled={!audioBlob || recording}>
            {t('diag.finish')}
          </button>
        </div>
      ) : questions[qIdx] ? (
        <>
          <p className="mono text-[11px] text-muted mt-3">
            {qIdx + 1} / {questions.length}
          </p>
          <div className="mt-2">
            <QuestionCard
              question={questions[qIdx]}
              answer={answers[questions[qIdx].id]}
              onAnswer={(v) => setAnswers((a) => ({ ...a, [questions[qIdx].id]: v }))}
            />
          </div>
          <div className="flex gap-2 mt-5">
            {qIdx > 0 && !questions[qIdx].section.includes('listening') && (
              <button className="btn ghost !flex-1" onClick={() => setQIdx(qIdx - 1)}>←</button>
            )}
            <button
              className="btn green flex-[3]"
              onClick={() => (qIdx < questions.length - 1 ? setQIdx(qIdx + 1) : finishSection())}
            >
              {qIdx < questions.length - 1 ? t('diag.next') : t('diag.finish')}
            </button>
          </div>
        </>
      ) : (
        <div className="card mt-6 text-center">
          <p className="text-[13px] text-muted">
            {locale === 'fr' ? 'Aucune question disponible pour cette section.' : 'No questions available for this section.'}
          </p>
          <button className="btn green mt-3" onClick={finishSection}>{t('exam.continue')}</button>
        </div>
      )}
    </ScreenShell>
  )
}
