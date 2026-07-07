#!/usr/bin/env node
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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
    console.log('🔌 Connexion à Supabase...\n');
    await client.connect();

    const phone = '+1234567890';
    const password = 'Test123456';
    const userId = crypto.randomUUID();
    const email = `phone_1234567890@ijambo.app`;

    // Hash du mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    console.log('📝 Création de l\'utilisateur Auth...');

    // Insérer dans auth.users
    await client.query(`
      INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, now(), now(), now()
      )
      ON CONFLICT (id) DO NOTHING;
    `, [userId, email, passwordHash]);

    console.log('👤 Création du profil...');

    // Insérer dans profiles
    await client.query(`
      INSERT INTO public.profiles (
        id, phone, first_name, last_name, role, locale, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, now()
      )
      ON CONFLICT (id) DO NOTHING;
    `, [userId, phone, 'Test', 'User', 'student', 'fr']);

    console.log('\n✅ Utilisateur créé avec succès!\n');
    console.log('📱 Infos de connexion:');
    console.log(`   Téléphone: ${phone}`);
    console.log(`   Mot de passe: ${password}`);
    console.log('\n🔗 Allez sur: https://ijamboenglish.netlify.app/login');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
