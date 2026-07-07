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

(async () => {
  try {
    await client.connect();

    console.log('📝 Mise à jour de l\'exam blanc TOEFL...\n');

    // Récupérer toutes les questions par section
    const readingRes = await client.query(
      'SELECT id FROM public.questions WHERE section = $1 AND status = $2 ORDER BY RANDOM() LIMIT 8',
      ['reading', 'published']
    );

    const listeningRes = await client.query(
      'SELECT id FROM public.questions WHERE section = $1 AND status = $2 ORDER BY RANDOM() LIMIT 8',
      ['listening', 'published']
    );

    const writingRes = await client.query(
      'SELECT id FROM public.questions WHERE section = $1 AND status = $2 ORDER BY RANDOM() LIMIT 1',
      ['writing', 'published']
    );

    const speakingRes = await client.query(
      'SELECT id FROM public.questions WHERE section = $1 AND status = $2 ORDER BY RANDOM() LIMIT 1',
      ['speaking', 'published']
    );

    const sections = [
      {
        name: 'Reading',
        duration_min: 35,
        rules: [{ section: 'reading', count: 8 }],
        order: 0,
        instructions_fr: '2 passages académiques. Vous pouvez revenir en arrière dans la section.',
        instructions_en: '2 academic passages. You may go back within the section.'
      },
      {
        name: 'Listening',
        duration_min: 36,
        rules: [{ section: 'listening', count: 8 }],
        order: 1,
        instructions_fr: 'Conversations et extraits de cours. Une seule écoute par audio.',
        instructions_en: 'Conversations and lecture excerpts. One listen per audio.'
      },
      {
        name: 'Writing',
        duration_min: 29,
        question_ids: writingRes.rows.map(r => r.id),
        order: 2,
        instructions_fr: 'Rédigez votre essai dans la zone de texte. Correction par votre coach sous 48 h.',
        instructions_en: 'Write your essay in the text area. Corrected by your coach within 48 h.'
      },
      {
        name: 'Speaking',
        duration_min: 16,
        question_ids: speakingRes.rows.map(r => r.id),
        order: 3,
        instructions_fr: 'Enregistrez votre réponse (45 s de préparation, 45 s de parole).',
        instructions_en: 'Record your answer (45 s preparation, 45 s speaking).'
      }
    ];

    const sectionsJson = JSON.stringify(sections);

    await client.query(
      'UPDATE public.exams SET sections = $1 WHERE id = $2',
      [sectionsJson, '30000000-0000-0000-0000-000000000001']
    );

    console.log('✅ Exam blanc TOEFL mis à jour!\n');
    console.log('📊 Sections:');
    console.log('   - Reading: 35 min (8 questions)');
    console.log('   - Listening: 36 min (8 questions)');
    console.log('   - Writing: 29 min (1 question)');
    console.log('   - Speaking: 16 min (1 question)');
    console.log('\n🔗 Test à: https://ijamboenglish.netlify.app/dashboard');

    await client.end();
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
