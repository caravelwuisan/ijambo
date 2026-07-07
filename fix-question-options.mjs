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

    console.log('🔧 Correction des options des questions...\n');

    // Récupérer toutes les questions
    const res = await client.query('SELECT id, options FROM public.questions WHERE status = $1', ['published']);

    let fixed = 0;

    for (const row of res.rows) {
      try {
        let opts = row.options;

        // Si c'est déjà un string JSON, parse-le
        if (typeof opts === 'string') {
          opts = JSON.parse(opts);
        }

        // Si c'est un array d'objets avec {letter, text}, extraire juste le text
        if (Array.isArray(opts) && opts.length > 0 && opts[0].text) {
          const newOpts = opts.map(o => o.text);

          await client.query(
            'UPDATE public.questions SET options = $1 WHERE id = $2',
            [JSON.stringify(newOpts), row.id]
          );

          fixed++;
        }
      } catch (e) {
        console.log(`Erreur pour ${row.id}: ${e.message}`);
      }
    }

    console.log(`✅ ${fixed} questions corrigées!\n`);
    console.log('🔗 Test: https://ijamboenglish.netlify.app/dashboard');

    await client.end();
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
