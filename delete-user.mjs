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
    await client.query('DELETE FROM public.profiles WHERE phone = $1;', ['+1234567890']);
    await client.query('DELETE FROM auth.users WHERE email = $1;', ['phone_1234567890@ijambo.app']);
    console.log('✅ Utilisateur supprimé');
    await client.end();
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
