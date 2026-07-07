import { useI18n, pickLang } from '../i18n'
import type { Question } from '../lib/types'

const SECTION_LABELS: Record<string, { fr: string; en: string; cls: string }> = {
  grammar: { fr: 'GRAMMAIRE · Vocabulaire', en: 'GRAMMAR · Vocabulary', cls: '' },
  reading: { fr: 'READING · Compréhension', en: 'READING · Comprehension', cls: 'gold' },
  listening: { fr: 'LISTENING · Écoute', en: 'LISTENING', cls: 'gold' },
  writing: { fr: 'WRITING · Auto-évaluation', en: 'WRITING · Self-assessment', cls: 'red' },
  speaking: { fr: 'SPEAKING · Auto-évaluation', en: 'SPEAKING · Self-assessment', cls: 'red' },
}

export function SectionPill({ section }: { section: string }) {
  const { locale } = useI18n()
  const s = SECTION_LABELS[section] ?? { fr: section, en: section, cls: '' }
  return <span className={`pill ${s.cls}`}>{locale === 'en' ? s.en : s.fr}</span>
}

const LETTERS = 'ABCDEFGH'

export default function QuestionCard({
  question,
  answer,
  onAnswer,
  showExplanation = false,
}: {
  question: Question
  answer: number[] | undefined
  onAnswer: (idx: number[]) => void
  showExplanation?: boolean
}) {
  const { locale } = useI18n()
  const multiple = question.type === 'qcm_multiple'
  const selfAssessed = question.correct.length === 0

  function toggle(i: number) {
    if (multiple) {
      const cur = answer ?? []
      onAnswer(cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort())
    } else {
      onAnswer([i])
    }
  }

  const passage = question.passage
  const isAudio = question.type === 'audio_qcm' || question.section === 'listening'

  return (
    <div className="flex flex-col gap-3">
      <SectionPill section={question.section} />

      {passage && !isAudio && <div className="passage">“{passage.body}”</div>}

      {isAudio &&
        (question.audio_url || passage?.audio_url ? (
          <audio controls preload="none" src={question.audio_url ?? passage?.audio_url ?? undefined} className="w-full" />
        ) : (
          passage && (
            <div className="passage !not-italic">
              <b className="text-[11px] not-italic text-muted block mb-1">
                🎧 {locale === 'fr' ? 'Audio bientôt disponible — transcription :' : 'Audio coming soon — transcript:'}
              </b>
              {passage.body}
            </div>
          )
        ))}

      <div className="text-[14.5px] font-semibold leading-snug">{pickLang(question, 'stem', locale)}</div>

      <div className="flex flex-col gap-2">
        {question.options.map((opt, i) => {
          const sel = answer?.includes(i)
          const good = showExplanation && question.correct.includes(i)
          const bad = showExplanation && sel && !question.correct.includes(i) && !selfAssessed
          return (
            <button
              key={i}
              type="button"
              className={`opt ${sel ? 'sel' : ''}`}
              style={good ? { borderColor: 'var(--green)', background: 'var(--green-soft)' } : bad ? { borderColor: 'var(--red)', background: '#FBE7EA' } : undefined}
              onClick={() => !showExplanation && toggle(i)}
            >
              <span className="k">{LETTERS[i]}</span>
              <span>{opt}</span>
            </button>
          )
        })}
      </div>

      {showExplanation && (question.explanation_fr || question.explanation_en) && (
        <div className="card !bg-green-soft !border-green">
          <p className="text-[12.5px] leading-relaxed text-body">
            <b className="text-green">{locale === 'fr' ? 'Explication : ' : 'Explanation: '}</b>
            {pickLang(question, 'explanation', locale)}
          </p>
        </div>
      )}
    </div>
  )
}
