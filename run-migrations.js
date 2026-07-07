#!/usr/bin/env node
/**
 * Script pour exécuter les migrations Supabase directement
 * Usage: node run-migrations.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Credentials (à remplir ou depuis .env)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zabfvamsoghlgokekwbb.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Erreur: SUPABASE_SERVICE_ROLE_KEY manquant');
  console.error('Vous devez passer la clé secrète (service role key) en variable d\'environnement:');
  console.error('  $env:SUPABASE_SERVICE_ROLE_KEY = "votre_cle_ici"');
  console.error('  node run-migrations.js');
  process.exit(1);
}

const migrations = [
  { name: '0001_schema', file: 'supabase/migrations/0001_schema.sql' },
  { name: '0002_rls', file: 'supabase/migrations/0002_rls.sql' },
  { name: '0003_functions', file: 'supabase/migrations/0003_functions.sql' },
  { name: 'seed', file: 'supabase/seed.sql' }
];

async function executeSql(sql, name) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`);

    const postData = JSON.stringify({ sql });
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ ${name} exécuté avec succès`);
          resolve(true);
        } else {
          console.error(`❌ Erreur ${res.statusCode} pour ${name}`);
          console.error(data);
          reject(new Error(data));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runAll() {
  console.log('🚀 Exécution des migrations...\n');

  for (const migration of migrations) {
    try {
      const filePath = path.join(__dirname, migration.file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`📝 ${migration.name}...`);
      await executeSql(sql, migration.name);

    } catch (err) {
      console.error(`\n❌ Erreur lors de ${migration.name}:`);
      console.error(err.message);
      process.exit(1);
    }
  }

  console.log('\n✨ Toutes les migrations sont exécutées !');
}

runAll();
