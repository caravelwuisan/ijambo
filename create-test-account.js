#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ewyjldxqdxhyjbjkxrza.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3eWpsZHhxZHhoeWpiamt4cnphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzQxOTUwMiwiZXhwIjoyMDk4OTk1NTAyfQ.7Un7cuGuWE5rEALyrnlIFc3GWdzO5-kaOkb1tbnrm3s'
);

(async () => {
  console.log('📝 Création du compte de test...\n');

  const { data, error } = await supabase.auth.admin.createUser({
    email: 'phone_18637032683@ijambo.app',
    password: 'Test1234!',
    user_metadata: {
      phone: '+18637032683',
      first_name: 'Laurent',
      last_name: 'Romuald',
      locale: 'fr'
    }
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Le compte existe déjà.');
    } else {
      console.error('❌ Erreur:', error.message);
      process.exit(1);
    }
  } else {
    console.log('✅ Compte créé avec succès!');
  }

  console.log('\n📱 Infos de connexion:');
  console.log('   Téléphone: +18637032683');
  console.log('   Mot de passe: Test1234!');
  console.log('\n🔗 Allez sur: https://ijamboenglish.netlify.app/login');
})();
