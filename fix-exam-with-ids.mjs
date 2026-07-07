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

    console.log('📝 Récupération des questions...\n');

    // Récupérer 8 questions reading
    const readingRes = await client.query(
      'SELECT id FROM public.questions WHERE section = $1 AND status = $2 ORDER BY difficulty LIMIT 8',
      ['reading', 'published']
    );

    // Récupérer 8 questions listening
    const listeningRes = await client.query(
      'SELECT id FROM public.questions WHERE section = $1 AND status = $2 ORDER BY difficulty LIMIT 8',
      ['listening', 'published']
    );

    console.log(`Found: ${readingRes.rows.length} reading questions`);
    console.log(`Found: ${listeningRes.rows.length} listening questions\n`);

    const sections = [
      {
        name: 'Reading',
        duration_min: 35,
        question_ids: readingRes.rows.map(r => r.id),
        order: 0,
        instructions_fr: '2 passages académiques. Vous pouvez revenir en arrière dans la section.',
        instructions_en: '2 academic passages. You may go back within the section.'
      },
      {
        name: 'Listening',
        duration_min: 36,
        question_ids: listeningRes.rows.map(r => r.id),
        order: 1,
        instructions_fr: 'Conversations et extraits de cours. Une seule écoute par audio.',
        instructions_en: 'Conversations and lecture excerpts. One listen per audio.'
      },
      {
        name: 'Writing',
        duration_min: 29,
        question_ids: ['a6494b77-84e8-478c-992f-614c2b1b616a'],
        order: 2,
        instructions_fr: 'Rédigez votre essai dans la zone de texte. Correction par votre coach sous 48 h.',
        instructions_en: 'Write your essay in the text area. Corrected by your coach within 48 h.'
      },
      {
        name: 'Speaking',
        duration_min: 16,
        question_ids: ['4951a5d8-a677-4b1d-a66f-a9e54cbdc6b3'],
        order: 3,
        instructions_fr: 'Enregistrez votre réponse (45 s de préparation, 45 s de parole).',
        instructions_en: 'Record your answer (45 s preparation, 45 s speaking).'
      }
    ];

    await client.query(
      'UPDATE public.exams SET sections = $1 WHERE id = $2',
      [JSON.stringify(sections), '30000000-0000-0000-0000-000000000001']
    );

    console.log('✅ Exam mis à jour avec les question_ids!\n');
    console.log('📊 Total questions:');
    console.log(`   - Reading: ${readingRes.rows.length}`);
    console.log(`   - Listening: ${listeningRes.rows.length}`);
    console.log(`   - Writing: 1`);
    console.log(`   - Speaking: 1`);
    console.log('\n🔗 Test: https://ijamboenglish.netlify.app/dashboard');

    await client.end();
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
