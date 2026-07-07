#!/usr/bin/env node
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: 'db.ewyjldxqdxhyjbjkxrza.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Manado2020@',
  ssl: { rejectUnauthorized: false }
});

const questions = [
  // GRAMMAR (5 questions)
  {
    type: 'qcm',
    section: 'grammar',
    difficulty: 2,
    stem_fr: 'She ___ to the store yesterday.',
    stem_en: 'She ___ to the store yesterday.',
    options: JSON.stringify([
      { letter: 'A', text: 'goes' },
      { letter: 'B', text: 'went' },
      { letter: 'C', text: 'has gone' },
      { letter: 'D', text: 'will go' }
    ]),
    correct: JSON.stringify(['B']),
    explanation_fr: 'Avec "yesterday", on utilise le passé simple "went".',
    explanation_en: 'With "yesterday", we use past simple "went".'
  },
  {
    type: 'qcm',
    section: 'grammar',
    difficulty: 2,
    stem_fr: 'If I ___ rich, I would travel around the world.',
    stem_en: 'If I ___ rich, I would travel around the world.',
    options: JSON.stringify([
      { letter: 'A', text: 'am' },
      { letter: 'B', text: 'was' },
      { letter: 'C', text: 'were' },
      { letter: 'D', text: 'had been' }
    ]),
    correct: JSON.stringify(['C']),
    explanation_fr: 'Conditionnel : on utilise "were" avec tous les sujets.',
    explanation_en: 'Conditional: we use "were" with all subjects in second conditional.'
  },
  {
    type: 'qcm',
    section: 'grammar',
    difficulty: 3,
    stem_fr: '___ working here for 5 years, she finally got promoted.',
    stem_en: '___ working here for 5 years, she finally got promoted.',
    options: JSON.stringify([
      { letter: 'A', text: 'After' },
      { letter: 'B', text: 'Having' },
      { letter: 'C', text: 'Since' },
      { letter: 'D', text: 'During' }
    ]),
    correct: JSON.stringify(['B']),
    explanation_fr: 'Participe passé composé : "Having worked" = après avoir travaillé.',
    explanation_en: 'Perfect participle: "Having worked" expresses an earlier action.'
  },
  {
    type: 'gap_fill',
    section: 'grammar',
    difficulty: 2,
    stem_fr: 'They don\'t like _____ football on weekends.',
    stem_en: 'They don\'t like _____ football on weekends.',
    options: JSON.stringify([
      { letter: 'A', text: 'play' },
      { letter: 'B', text: 'playing' },
      { letter: 'C', text: 'to play' },
      { letter: 'D', text: 'played' }
    ]),
    correct: JSON.stringify(['B']),
    explanation_fr: 'Après "like", on utilise le gérondif "playing".',
    explanation_en: 'After "like", we use gerund "playing".'
  },
  {
    type: 'qcm',
    section: 'grammar',
    difficulty: 3,
    stem_fr: 'The report, ___ by the manager, contained several errors.',
    stem_en: 'The report, ___ by the manager, contained several errors.',
    options: JSON.stringify([
      { letter: 'A', text: 'written' },
      { letter: 'B', text: 'writing' },
      { letter: 'C', text: 'to write' },
      { letter: 'D', text: 'writes' }
    ]),
    correct: JSON.stringify(['A']),
    explanation_fr: 'Participe passé en apposition : "written" = rédigé.',
    explanation_en: 'Past participle in apposition: describes the report.'
  },

  // READING (5 questions)
  {
    type: 'qcm',
    section: 'reading',
    difficulty: 2,
    stem_fr: 'Quel est le sujet principal du texte?\n\n"Climate change is affecting global weather patterns. Scientists predict rising sea levels will displace millions of people."',
    stem_en: 'What is the main idea of the text?\n\n"Climate change is affecting global weather patterns. Scientists predict rising sea levels will displace millions of people."',
    options: JSON.stringify([
      { letter: 'A', text: 'Les causes du changement climatique' },
      { letter: 'B', text: 'L\'impact du changement climatique sur le niveau des mers' },
      { letter: 'C', text: 'Comment les scientifiques font des prédictions' },
      { letter: 'D', text: 'La migration humaine' }
    ]),
    correct: JSON.stringify(['B']),
    explanation_fr: 'Le texte parle des effets du changement climatique et de l\'élévation du niveau des mers.',
    explanation_en: 'The text discusses climate change effects and rising sea levels.'
  },
  {
    type: 'qcm',
    section: 'reading',
    difficulty: 2,
    stem_fr: 'Selon le texte, quel sera l\'effet de l\'élévation du niveau des mers?\n\n"Rising sea levels will displace millions of people from coastal areas."',
    stem_en: 'According to the text, what will rising sea levels cause?\n\n"Rising sea levels will displace millions of people from coastal areas."',
    options: JSON.stringify([
      { letter: 'A', text: 'Plus de tempêtes' },
      { letter: 'B', text: 'Le déplacement de millions de personnes' },
      { letter: 'C', text: 'La destruction des océans' },
      { letter: 'D', text: 'L\'augmentation des températures' }
    ]),
    correct: JSON.stringify(['B']),
    explanation_fr: 'Le texte dit explicitement que les gens seront déplacés.',
    explanation_en: 'The text explicitly states people will be displaced.'
  },
  {
    type: 'qcm',
    section: 'reading',
    difficulty: 3,
    stem_fr: 'Quel est le ton du texte?\n\n"While renewable energy shows promise, critics argue it cannot yet replace fossil fuels. However, ongoing innovations suggest this view may soon become outdated."',
    stem_en: 'What is the tone of the text?\n\n"While renewable energy shows promise, critics argue it cannot yet replace fossil fuels. However, ongoing innovations suggest this view may soon become outdated."',
    options: JSON.stringify([
      { letter: 'A', text: 'Pessimiste' },
      { letter: 'B', text: 'Optimiste' },
      { letter: 'C', text: 'Ironique' },
      { letter: 'D', text: 'Neutre' }
    ]),
    correct: JSON.stringify(['B']),
    explanation_fr: 'Le "However" et "innovations suggest" montrent un ton optimiste.',
    explanation_en: 'The "However" and "innovations suggest" indicate optimism.'
  },
  {
    type: 'qcm',
    section: 'reading',
    difficulty: 2,
    stem_fr: 'Le mot "outdated" signifie:\n\n"However, ongoing innovations suggest this view may soon become outdated."',
    stem_en: 'The word "outdated" means:\n\n"However, ongoing innovations suggest this view may soon become outdated."',
    options: JSON.stringify([
      { letter: 'A', text: 'Trop ancien, dépassé' },
      { letter: 'B', text: 'Très moderne' },
      { letter: 'C', text: 'Bien pensé' },
      { letter: 'D', text: 'Difficile' }
    ]),
    correct: JSON.stringify(['A']),
    explanation_fr: '"Outdated" = dépassé, obsolète.',
    explanation_en: '"Outdated" = no longer current or fashionable.'
  },
  {
    type: 'qcm',
    section: 'reading',
    difficulty: 3,
    stem_fr: 'Pourquoi les critiques pensent-ils que l\'énergie renouvelable ne peut pas remplacer les combustibles fossiles?',
    stem_en: 'Why do critics think renewable energy cannot replace fossil fuels?',
    options: JSON.stringify([
      { letter: 'A', text: 'Parce que c\'est trop cher' },
      { letter: 'B', text: 'Parce qu\'elle n\'est pas assez avancée actuellement' },
      { letter: 'C', text: 'Parce que les gens ne l\'aiment pas' },
      { letter: 'D', text: 'Le texte ne le spécifie pas' }
    ]),
    correct: JSON.stringify(['D']),
    explanation_fr: 'Le texte mentionne que les critiques existent mais ne donne pas leurs raisons spécifiques.',
    explanation_en: 'The text mentions critics but doesn\'t specify their reasons.'
  },

  // LISTENING (5 questions)
  {
    type: 'audio_qcm',
    section: 'listening',
    difficulty: 2,
    stem_fr: '[AUDIO] Où est-ce que cette personne va?',
    stem_en: '[AUDIO] Where is this person going?',
    options: JSON.stringify([
      { letter: 'A', text: 'À la gare' },
      { letter: 'B', text: 'À l\'aéroport' },
      { letter: 'C', text: 'À l\'école' },
      { letter: 'D', text: 'Au musée' }
    ]),
    correct: JSON.stringify(['B']),
    explanation_fr: 'L\'audio mentionne un vol et une destination internationale.',
    explanation_en: 'The audio mentions a flight and international destination.'
  },
  {
    type: 'audio_qcm',
    section: 'listening',
    difficulty: 2,
    stem_fr: '[AUDIO] À quelle heure est-ce que le rendez-vous est prévu?',
    stem_en: '[AUDIO] What time is the appointment scheduled?',
    options: JSON.stringify([
      { letter: 'A', text: '9:00 AM' },
      { letter: 'B', text: '2:00 PM' },
      { letter: 'C', text: '3:30 PM' },
      { letter: 'D', text: '4:45 PM' }
    ]),
    correct: JSON.stringify(['C']),
    explanation_fr: 'L\'audio précise clairement 3h30 de l\'après-midi.',
    explanation_en: 'The audio clearly states 3:30 PM.'
  },
  {
    type: 'audio_qcm',
    section: 'listening',
    difficulty: 3,
    stem_fr: '[AUDIO] Quel est le problème principal mentionné?',
    stem_en: '[AUDIO] What is the main problem mentioned?',
    options: JSON.stringify([
      { letter: 'A', text: 'Un manque de budget' },
      { letter: 'B', text: 'Une mauvaise communication d\'équipe' },
      { letter: 'C', text: 'Des délais serrés' },
      { letter: 'D', text: 'Tous les éléments ci-dessus' }
    ]),
    correct: JSON.stringify(['D']),
    explanation_fr: 'L\'audio mentionne tous ces problèmes au cours de la conversation.',
    explanation_en: 'The audio mentions all these issues during the conversation.'
  },
  {
    type: 'audio_qcm',
    section: 'listening',
    difficulty: 2,
    stem_fr: '[AUDIO] Combien de personnes participent à cette conversation?',
    stem_en: '[AUDIO] How many people are participating in this conversation?',
    options: JSON.stringify([
      { letter: 'A', text: '2' },
      { letter: 'B', text: '3' },
      { letter: 'C', text: '4' },
      { letter: 'D', text: '5' }
    ]),
    correct: JSON.stringify(['B']),
    explanation_fr: 'Trois voix distinctes peuvent être entendues dans l\'audio.',
    explanation_en: 'Three distinct voices can be heard in the audio.'
  },
  {
    type: 'audio_qcm',
    section: 'listening',
    difficulty: 3,
    stem_fr: '[AUDIO] Quelle est l\'attitude du locuteur principal?',
    stem_en: '[AUDIO] What is the attitude of the main speaker?',
    options: JSON.stringify([
      { letter: 'A', text: 'Positive et confiante' },
      { letter: 'B', text: 'Négative et découragée' },
      { letter: 'C', text: 'Neutre et objective' },
      { letter: 'D', text: 'Confuse et incertaine' }
    ]),
    correct: JSON.stringify(['A']),
    explanation_fr: 'Le ton et les paroles indiquent une attitude positive et motivée.',
    explanation_en: 'The tone and words indicate a positive and motivated attitude.'
  },

  // WRITING (3 questions - self-assessment)
  {
    type: 'qcm',
    section: 'writing',
    difficulty: 2,
    stem_fr: 'Auto-évaluation : Pouvez-vous écrire un email professionnel formel?',
    stem_en: 'Self-assessment: Can you write a formal business email?',
    options: JSON.stringify([
      { letter: 'A', text: 'Non, je ne peux pas' },
      { letter: 'B', text: 'Oui, avec beaucoup de difficultés' },
      { letter: 'C', text: 'Oui, avec quelques erreurs' },
      { letter: 'D', text: 'Oui, sans problème' }
    ]),
    correct: JSON.stringify(['C']),
    explanation_fr: 'Niveau intermédiaire : capacité à écrire avec quelques erreurs mineures.',
    explanation_en: 'Intermediate level: ability to write with minor errors.',
    scoring_map: JSON.stringify([
      { answer: 'A', points: 10 },
      { answer: 'B', points: 25 },
      { answer: 'C', points: 50 },
      { answer: 'D', points: 80 }
    ])
  },
  {
    type: 'qcm',
    section: 'writing',
    difficulty: 3,
    stem_fr: 'Auto-évaluation : Pouvez-vous rédiger un essai argumenté cohérent?',
    stem_en: 'Self-assessment: Can you write a coherent argumentative essay?',
    options: JSON.stringify([
      { letter: 'A', text: 'Non' },
      { letter: 'B', text: 'Avec aide/traduction' },
      { letter: 'C', text: 'Oui, avec quelques erreurs' },
      { letter: 'D', text: 'Oui, facilement' }
    ]),
    correct: JSON.stringify(['C']),
    explanation_fr: 'Capacité intermédiaire à rédiger avec structure et logique.',
    explanation_en: 'Intermediate ability to write with structure and logic.',
    scoring_map: JSON.stringify([
      { answer: 'A', points: 15 },
      { answer: 'B', points: 35 },
      { answer: 'C', points: 60 },
      { answer: 'D', points: 90 }
    ])
  },
  {
    type: 'qcm',
    section: 'writing',
    difficulty: 2,
    stem_fr: 'Auto-évaluation : Utilisez-vous correctement la ponctuation et la grammaire?',
    stem_en: 'Self-assessment: Do you use punctuation and grammar correctly?',
    options: JSON.stringify([
      { letter: 'A', text: 'Rarement' },
      { letter: 'B', text: 'Parfois' },
      { letter: 'C', text: 'Souvent' },
      { letter: 'D', text: 'Toujours' }
    ]),
    correct: JSON.stringify(['C']),
    explanation_fr: 'Niveau B1-B2 : bonne maîtrise avec quelques erreurs.',
    explanation_en: 'B1-B2 level: good control with minor errors.',
    scoring_map: JSON.stringify([
      { answer: 'A', points: 20 },
      { answer: 'B', points: 40 },
      { answer: 'C', points: 65 },
      { answer: 'D', points: 95 }
    ])
  },

  // SPEAKING (2 questions - self-assessment)
  {
    type: 'qcm',
    section: 'speaking',
    difficulty: 2,
    stem_fr: 'Auto-évaluation : Pouvez-vous vous exprimer clairement en anglais?',
    stem_en: 'Self-assessment: Can you speak English clearly?',
    options: JSON.stringify([
      { letter: 'A', text: 'Difficilement' },
      { letter: 'B', text: 'Avec hésitations' },
      { letter: 'C', text: 'Assez clairement' },
      { letter: 'D', text: 'Très clairement' }
    ]),
    correct: JSON.stringify(['C']),
    explanation_fr: 'Bonne clarté de parole à niveau intermédiaire.',
    explanation_en: 'Good clarity at intermediate level.',
    scoring_map: JSON.stringify([
      { answer: 'A', points: 20 },
      { answer: 'B', points: 40 },
      { answer: 'C', points: 65 },
      { answer: 'D', points: 95 }
    ])
  },
  {
    type: 'qcm',
    section: 'speaking',
    difficulty: 3,
    stem_fr: 'Auto-évaluation : Pouvez-vous participer activement dans une réunion professionnelle?',
    stem_en: 'Self-assessment: Can you actively participate in a business meeting?',
    options: JSON.stringify([
      { letter: 'A', text: 'Non' },
      { letter: 'B', text: 'Avec difficulté' },
      { letter: 'C', text: 'Oui, assez bien' },
      { letter: 'D', text: 'Oui, très bien' }
    ]),
    correct: JSON.stringify(['C']),
    explanation_fr: 'Capacité à participer à niveau B1-B2.',
    explanation_en: 'Ability to participate at B1-B2 level.',
    scoring_map: JSON.stringify([
      { answer: 'A', points: 15 },
      { answer: 'B', points: 35 },
      { answer: 'C', points: 70 },
      { answer: 'D', points: 100 }
    ])
  }
];

(async () => {
  try {
    console.log('🔌 Connexion à Supabase...\n');
    await client.connect();

    console.log('📝 Ajout de 25 questions de diagnostic...\n');

    const questionIds = [];

    for (const q of questions) {
      const res = await client.query(`
        INSERT INTO public.questions (
          type, section, difficulty, stem_fr, stem_en, options, correct,
          explanation_fr, explanation_en, weight, scoring_map, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'published')
        RETURNING id;
      `, [
        q.type,
        q.section,
        q.difficulty,
        q.stem_fr,
        q.stem_en,
        q.options,
        q.correct,
        q.explanation_fr,
        q.explanation_en,
        1,
        q.scoring_map || null
      ]);

      questionIds.push(res.rows[0].id);
    }

    console.log(`✅ ${questions.length} questions créées!\n`);

    // Mettre à jour le test diagnostic avec les question_ids
    await client.query(`
      UPDATE public.tests
      SET question_ids = $1
      WHERE id = '00000000-0000-0000-0000-000000000001';
    `, [questionIds]);

    console.log('🎯 Test diagnostic mis à jour!\n');
    console.log('📊 Composition:');
    console.log('   - Grammar: 5 questions');
    console.log('   - Reading: 5 questions');
    console.log('   - Listening: 5 questions');
    console.log('   - Writing: 3 questions (auto-évaluation)');
    console.log('   - Speaking: 2 questions (auto-évaluation)');
    console.log('\n🔗 Test à: https://ijamboenglish.netlify.app/diagnostic');

    await client.end();
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
