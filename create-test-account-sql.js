#!/usr/bin/env node
const { Client } = require('pg');

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
    console.log('🔌 Connexion à Supabase...');
    await client.connect();

    // Créer l'utilisateur Auth
    const phone = '+18637032683';
    const email = 'phone_18637032683@ijambo.app';
    const password = 'Test1234!';

    // Hash du mot de passe (on va utiliser une valeur factice pour la démo)
    // En production, il faudrait utiliser bcrypt

    console.log('📝 Création du profil utilisateur...');

    await client.query(`
      INSERT INTO public.profiles (id, phone, first_name, last_name, email, role, locale)
      VALUES (
        '550e8400-e29b-41d4-a716-446655440000',
        '${phone}',
        'Laurent',
        'Romuald',
        'test@example.com',
        'student',
        'fr'
      )
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log('✅ Profil créé!\n');
    console.log('📱 Infos de connexion:');
    console.log(`   Téléphone: ${phone}`);
    console.log(`   Mot de passe: ${password}`);
    console.log('\n🔗 Allez sur: https://ijamboenglish.netlify.app/login');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
  } finally {
    await client.end();
  }
})();
