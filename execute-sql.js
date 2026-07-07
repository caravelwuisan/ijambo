#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const client = new Client({
  host: 'db.ewyjldxqdxhyjbjkxrza.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Manado2020@',
  ssl: { rejectUnauthorized: false }
});

const migrations = [
  'supabase/migrations/0001_schema.sql',
  'supabase/migrations/0002_rls.sql',
  'supabase/migrations/0003_functions.sql',
  'supabase/seed.sql'
];

async function run() {
  try {
    console.log('🔌 Connexion à Supabase...');
    await client.connect();
    console.log('✅ Connecté\n');

    for (const file of migrations) {
      const filePath = path.join(__dirname, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      const name = path.basename(file);

      console.log(`📝 ${name}...`);
      await client.query(sql);
      console.log(`✅ ${name}\n`);
    }

    console.log('✨ Toutes les migrations exécutées !');
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
