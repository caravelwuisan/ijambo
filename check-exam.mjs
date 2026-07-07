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

    const examRes = await client.query(
      'SELECT sections FROM public.exams WHERE id = $1;',
      ['30000000-0000-0000-0000-000000000001']
    );

    if (examRes.rows.length === 0) {
      console.log('❌ Exam non trouvé');
      process.exit(1);
    }

    console.log('📋 Sections de l\'exam:\n');
    console.log(JSON.stringify(examRes.rows[0].sections, null, 2));

    // Vérifier les questions
    const questionsRes = await client.query(
      'SELECT COUNT(*) FROM public.questions WHERE section = $1 AND status = $2',
      ['reading', 'published']
    );

    console.log(`\n📊 Questions publiées: ${questionsRes.rows[0].count} (reading)`);

    await client.end();
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
