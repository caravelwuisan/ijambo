#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = 'https://ewyjldxqdxhyjbjkxrza.supabase.co';
const JWT_TOKEN = process.argv[2] || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3eWpsZHhxZHhoeWpiamt4cnphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzQxOTUwMiwiZXhwIjoyMDk4OTk1NTAyfQ.7Un7cuGuWE5rEALyrnlIBc3GWdzO5-kaOkb1tbnrm3s';

const migrations = [
  'supabase/migrations/0001_schema.sql',
  'supabase/migrations/0002_rls.sql',
  'supabase/migrations/0003_functions.sql',
  'supabase/seed.sql'
];

async function executeSql(sql, name) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: 'ewyjldxqdxhyjbjkxrza.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/execute_raw_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'apikey': JWT_TOKEN
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          console.log(`✅ ${name}`);
          resolve();
        } else {
          console.error(`❌ ${name} - ${res.statusCode}`);
          console.error(data);
          reject(new Error(data));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('🚀 Exécution des migrations...\n');

  for (const file of migrations) {
    const filePath = path.join(__dirname, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    try {
      console.log(`📝 ${path.basename(file)}...`);
      await executeSql(sql, path.basename(file));
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`\n❌ Erreur: ${err.message}`);
      process.exit(1);
    }
  }

  console.log('\n✨ Migrations complétées !');
}

main();
