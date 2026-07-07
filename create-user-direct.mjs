#!/usr/bin/env node
import pg from 'pg';
import crypto from 'crypto';

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
    console.log('🔌 Connexion à Supabase...\n');
    await client.connect();

    const phone = '+1234567890';
    const password = 'Test123456';
    const userId = crypto.randomUUID();
    const email = `phone_1234567890@ijambo.app`;

    console.log('🗑️  Suppression de l\'ancien utilisateur si existant...');

    // Supprimer d'abord l'utilisateur ancien
    await client.query(`DELETE FROM auth.users WHERE email = $1;`, [email]);

    console.log('📝 Création de l\'utilisateur Auth avec pgcrypto...');

    // Utiliser la fonction crypt() de PostgreSQL (comme Supabase le fait)
    await client.query(`
      INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
      ) VALUES (
        $1, $2, crypt($3, gen_salt('bf')), now(), now(), now(), '{}', $4::jsonb
      );
    `, [
      userId,
      email,
      password,
      JSON.stringify({
        phone: phone,
        first_name: 'Test',
        last_name: 'User'
      })
    ]);

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
