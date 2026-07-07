#!/usr/bin/env node
import fetch from 'node-fetch';
import crypto from 'crypto';

const SUPABASE_URL = 'https://ewyjldxqdxhyjbjkxrza.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3eWpsZHhxZHhoeWpiamt4cnphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzQxOTUwMiwiZXhwIjoyMDk4OTk1NTAyfQ.7Un7cuGuWE5rEALyrnlIBc3GWdzO5-kaOkb1tbnrm3s';

const phone = '+1234567890';
const password = 'Test123456';
const email = `phone_1234567890@ijambo.app`;

console.log('🔌 Création via API Supabase Auth...\n');

(async () => {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY
      },
      body: JSON.stringify({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          phone: phone,
          first_name: 'Test',
          last_name: 'User'
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Erreur:', data.message || data.error_description);
      process.exit(1);
    }

    console.log('✅ Utilisateur créé via API!\n');
    console.log('📱 Infos de connexion:');
    console.log(`   Téléphone: ${phone}`);
    console.log(`   Mot de passe: ${password}`);
    console.log('\n🔗 Allez sur: https://ijamboenglish.netlify.app/login');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
