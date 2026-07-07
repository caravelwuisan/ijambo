// Génère supabase/seed.sql à partir des banques JSON fournies avec le cahier des charges.
// Usage : node scripts/generate-seed.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const dataDir = resolve(root, '..') // les JSON sont à la racine du dossier IJAMBO

const diag = JSON.parse(readFileSync(resolve(dataDir, 'diagnostic-ijambo-v1.json'), 'utf8'))
const bank = JSON.parse(readFileSync(resolve(dataDir, 'banque-quiz-lecons-v1.json'), 'utf8'))

const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`)
const jsonb = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
const arr = (a) => (a?.length ? `array[${a.map(q).join(',')}]::text[]` : `'{}'::text[]`)

const lines = []
lines.push('-- ============================================================')
lines.push('-- IJAMBO English — seed.sql (généré par scripts/generate-seed.mjs)')
lines.push('-- Plans, paramètres, diagnostic V1, banque de quiz, formation TOEFL démo')
lines.push('-- ============================================================\n')

// ---------- Passages (textes + scripts audio à générer en TTS) ----------
const passageIds = new Map() // title -> uuid
function passageFor(item) {
  const src = item.passage ?? item.audio_script
  const ref = item.passage_ref ?? item.audio_script_ref
  if (src) {
    if (!passageIds.has(src.title)) {
      const id = randomUUID()
      passageIds.set(src.title, id)
      const body = src.text ?? src.body
      lines.push(
        `insert into public.passages (id, title, body) values (${q(id)}, ${q(src.title)}, ${q(body)});`,
      )
    }
    return passageIds.get(src.title)
  }
  if (ref) return passageIds.get(ref) ?? null
  return null
}

lines.push('-- ---------- Passages et scripts audio ----------')
const allQuestions = []
for (const [source, kindTag] of [
  [diag, 'diagnostic-v1'],
  [bank, 'quiz-bank-v1'],
]) {
  for (const item of source.questions) {
    const pid = passageFor(item)
    const id = randomUUID()
    allQuestions.push({ ...item, _id: id, _pid: pid, _src: kindTag })
  }
}

lines.push('\n-- ---------- Questions (statut published) ----------')
for (const it of allQuestions) {
  lines.push(
    `insert into public.questions (id, type, section, difficulty, stem_fr, stem_en, passage_id, options, correct, explanation_fr, explanation_en, weight, scoring_map, tags, status) values (` +
      [
        q(it._id),
        q(it.type),
        q(it.section),
        it.difficulty ?? 1,
        q(it.stem_fr),
        q(it.stem_en),
        it._pid ? q(it._pid) : 'null',
        jsonb(it.options ?? []),
        jsonb(it.correct ?? []),
        q(it.explanation_fr),
        q(it.explanation_en),
        it.weight ?? 1,
        it.scoring_map ? jsonb(it.scoring_map) : 'null',
        arr([...(it.tags ?? []), it._src]),
        `'published'`,
      ].join(', ') +
      ');',
  )
}

// ---------- Test diagnostic actif ----------
const diagQuestionIds = allQuestions.filter((x) => x._src === 'diagnostic-v1').map((x) => x._id)
const diagId = randomUUID()
lines.push('\n-- ---------- Test diagnostic V1 (actif) ----------')
lines.push(
  `insert into public.tests (id, name, kind, duration_min, question_ids, scoring, is_active, status) values (` +
    [
      q(diagId),
      q(diag.test.name),
      `'diagnostic'`,
      diag.test.duration_min,
      `array[${diagQuestionIds.map(q).join(',')}]::uuid[]`,
      jsonb(diag.test.scoring),
      'true',
      `'published'`,
    ].join(', ') +
    ');',
)

// ---------- Quiz de leçons par règles (tags) ----------
lines.push('\n-- ---------- Quiz de leçons (sélection par règles) ----------')
const quizDefs = [
  ['Quiz — Temps du présent', ['lesson-tenses-1'], 4],
  ['Quiz — Passé et present perfect', ['lesson-tenses-2', 'lesson-tenses-3'], 5],
  ['Quiz — Prépositions', ['lesson-prepositions'], 4],
  ['Quiz — Modaux', ['lesson-modals'], 4],
  ['Quiz — Reading : Mobile Money', ['quiz-bank-v1'], 4, 'reading'],
  ['Quiz — Listening : campus', ['quiz-bank-v1'], 4, 'listening'],
]
const quizIds = []
for (const [name, tags, count, section] of quizDefs) {
  const id = randomUUID()
  quizIds.push(id)
  const rules = [{ tags, count, ...(section ? { section } : {}) }]
  lines.push(
    `insert into public.tests (id, name, kind, question_rules, is_active, status) values (` +
      [q(id), q(name), `'quiz_lecon'`, jsonb(rules), 'false', `'published'`].join(', ') +
      ');',
  )
}

// ---------- Formation TOEFL démo : 5 modules, leçons ----------
lines.push('\n-- ---------- Formation « Programme TOEFL 10 semaines » ----------')
const courseId = randomUUID()
lines.push(
  `insert into public.courses (id, name, target, description, duration_weeks, status, sort) values (` +
    [
      q(courseId),
      q('Programme TOEFL 10 semaines'),
      q('toefl'),
      q('Programme complet de préparation au TOEFL iBT pour francophones : Listening, Reading, Writing, Speaking et stratégie d’examen.'),
      10,
      q('published'),
      0,
    ].join(', ') +
    ');',
)

const moduleDefs = [
  ['Listening', '🎧'],
  ['Reading', '📖'],
  ['Writing', '✍️'],
  ['Speaking', '🗣'],
  ['Stratégie', '🧭'],
]
const lessonDefs = {
  Listening: [
    ['Comprendre les conversations campus', 'Repérer la situation, le problème et la solution dans une conversation étudiante type TOEFL.', 5],
    ['Les cours magistraux académiques', 'Identifier le sujet principal, les exemples et la structure d’un extrait de cours.', 4],
  ],
  Reading: [
    ['Trouver l’idée principale', 'Distinguer l’idée centrale des détails de support — le piège n°1 du TOEFL Reading.', 4],
    ['Vocabulaire en contexte', 'Déduire le sens d’un mot par son contexte sans dictionnaire.', 2],
  ],
  Writing: [
    ['Structurer un essai en 30 minutes', 'Le plan en 4 paragraphes : introduction, deux arguments, conclusion.', 0],
    ['Les connecteurs logiques', 'However, despite, although : lier ses idées comme au niveau B2+.', 3],
  ],
  Speaking: [
    ['Parler 45 secondes sans bloquer', 'La méthode Point-Raison-Exemple pour les questions indépendantes.', 0],
  ],
  Stratégie: [
    ['Gérer son temps le jour J', 'Rythme par section, questions à sauter, gestion du stress.', 0],
  ],
}

let mSort = 0
for (const [mName, icon] of moduleDefs) {
  const mId = randomUUID()
  lines.push(
    `insert into public.modules (id, course_id, name, icon, sort) values (${q(mId)}, ${q(courseId)}, ${q(mName)}, ${q(icon)}, ${mSort++});`,
  )
  let lSort = 0
  for (const [title, desc, quizIdx] of lessonDefs[mName] ?? []) {
    const body = `# ${title}\n\n${desc}\n\n## Ce que vous allez apprendre\n\n- La méthode pas à pas, illustrée d'exemples du contexte burundais\n- Les pièges typiques pour les francophones\n- Un exercice guidé avant le quiz\n\n> **Astuce IJAMBO** : travaillez cette leçon en 2 sessions de 15 minutes plutôt qu'une seule de 30.\n\n*Contenu complet à rédiger dans le back-office (§6.5).*`
    lines.push(
      `insert into public.lessons (id, module_id, title, body_md, quiz_test_id, pass_threshold, est_minutes, sort, status) values (` +
        [
          q(randomUUID()),
          q(mId),
          q(title),
          q(body),
          quizIdx ? q(quizIds[quizIdx]) : q(quizIds[0]),
          70,
          25,
          lSort++,
          q('published'),
        ].join(', ') +
        ');',
    )
  }
}

// ---------- Examen blanc TOEFL démo ----------
lines.push('\n-- ---------- Examen blanc TOEFL n°1 ----------')
const examSections = [
  { name: 'Reading', duration_min: 35, rules: [{ section: 'reading', count: 8 }], order: 0, instructions_fr: '2 passages académiques. Vous pouvez revenir en arrière dans la section.', instructions_en: '2 academic passages. You may go back within the section.' },
  { name: 'Listening', duration_min: 36, rules: [{ section: 'listening', count: 8 }], order: 1, instructions_fr: 'Conversations et extraits de cours. Une seule écoute par audio.', instructions_en: 'Conversations and lecture excerpts. One listen per audio.' },
  { name: 'Writing', duration_min: 29, rules: [{ section: 'writing', count: 1 }], order: 2, instructions_fr: 'Rédigez votre essai dans la zone de texte. Correction par votre coach sous 48 h.', instructions_en: 'Write your essay in the text area. Corrected by your coach within 48 h.' },
  { name: 'Speaking', duration_min: 16, rules: [{ section: 'speaking', count: 1 }], order: 3, instructions_fr: 'Enregistrez votre réponse (45 s de préparation, 45 s de parole).', instructions_en: 'Record your answer (45 s preparation, 45 s speaking).' },
]
lines.push(
  `insert into public.exams (id, name, target, sections, status) values (${q(randomUUID())}, ${q('Test blanc TOEFL n°1')}, 'toefl', ${jsonb(examSections)}, 'published');`,
)

// ---------- Plans (grille tarifaire de la maquette) ----------
lines.push('\n-- ---------- Formules tarifaires ----------')
const plans = [
  {
    name: 'Essentiel',
    price: 75000,
    days: 120,
    exam_quota: 2,
    coaching: 0,
    sort: 0,
    features: {
      fr: [
        'Programme personnalisé complet (4 sections)',
        '200+ questions avec corrigés en français',
        '2 tests blancs chronométrés',
        'Suivi de progression semaine par semaine',
      ],
      en: [
        'Full personalised programme (4 sections)',
        '200+ questions with French explanations',
        '2 timed mock tests',
        'Week-by-week progress tracking',
      ],
    },
  },
  {
    name: 'Accompagné',
    price: 150000,
    days: 120,
    exam_quota: 4,
    coaching: 0,
    sort: 1,
    features: {
      highlight: true,
      fr: [
        'Tout le pack Essentiel',
        '4 tests blancs + analyses détaillées',
        'Sessions live de groupe chaque semaine',
        'Correction individuelle Writing & Speaking',
      ],
      en: [
        'Everything in Essentiel',
        '4 mock tests + detailed analysis',
        'Weekly live group sessions',
        'Individual Writing & Speaking correction',
      ],
    },
  },
  {
    name: 'Premium présentiel',
    price: 250000,
    days: 120,
    exam_quota: 4,
    coaching: 8,
    sort: 2,
    features: {
      fr: [
        'Tout le pack Accompagné',
        '8 sessions individuelles avec Coach Jacques',
        'Simulation orale complète en conditions réelles',
        'Aide au dossier de bourse (relecture CV/lettre)',
      ],
      en: [
        'Everything in Accompagné',
        '8 individual sessions with Coach Jacques',
        'Full oral simulation in real conditions',
        'Scholarship file support (CV/letter review)',
      ],
    },
  },
]
for (const p of plans) {
  lines.push(
    `insert into public.plans (id, name, price_bif, access_days, features, course_ids, exam_quota, coaching_sessions, is_active, sort) values (` +
      [
        q(randomUUID()),
        q(p.name),
        p.price,
        p.days,
        jsonb(p.features),
        `array[${q(courseId)}]::uuid[]`,
        p.exam_quota,
        p.coaching,
        'true',
        p.sort,
      ].join(', ') +
      ');',
  )
}

// ---------- Paramètres (§6.8) ----------
lines.push('\n-- ---------- Paramètres app ----------')
const settings = {
  lumicash_merchant_code: { label: 'IJAMBO', code: '40217', ussd: '*163#' },
  whatsapp_numbers: { support: '+25779000000', admin: '+25779000001' },
  det_threshold: 60,
  live_session_links: { speaking: '', writing: '' },
  home_texts: {
    fr: { greeting: 'Amahoro ! 👋', sub: "Découvrez votre niveau réel en 25 minutes et recevez votre plan de préparation personnalisé jusqu'au jour de l'examen." },
    en: { greeting: 'Amahoro! 👋', sub: 'Discover your real level in 25 minutes and receive your personalised preparation plan all the way to exam day.' },
  },
  home_stats: { questions: '200+', mock_tests: '4', max_data: '2 Go' },
  diagnostic_unlocks: [],
}
for (const [k, v] of Object.entries(settings)) {
  lines.push(`insert into public.app_settings (key, value) values (${q(k)}, ${jsonb(v)}) on conflict (key) do update set value = excluded.value;`)
}

lines.push('')
const outPath = resolve(root, 'supabase', 'seed.sql')
writeFileSync(outPath, lines.join('\n'), 'utf8')
console.log(`seed.sql généré : ${allQuestions.length} questions, ${passageIds.size} passages → ${outPath}`)
