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

    // Récupérer l'ID de l'utilisateur
    const userRes = await client.query(
      'SELECT id FROM auth.users WHERE email = $1',
      ['phone_1234567890@ijambo.app']
    );

    if (userRes.rows.length === 0) {
      console.error('❌ Utilisateur non trouvé');
      process.exit(1);
    }

    const userId = userRes.rows[0].id;

    // Récupérer la première formule (Essentiel)
    const planRes = await client.query(
      'SELECT id FROM public.plans WHERE name = $1',
      ['Essentiel']
    );

    if (planRes.rows.length === 0) {
      console.error('❌ Formule non trouvée');
      process.exit(1);
    }

    const planId = planRes.rows[0].id;

    // Créer une inscription active pour 120 jours
    await client.query(`
      INSERT INTO public.enrollments (user_id, plan_id, starts_at, expires_at, status)
      VALUES ($1, $2, now(), now() + interval '120 days', 'active')
      ON CONFLICT DO NOTHING;
    `, [userId, planId]);

    console.log('✅ Inscription créée!\n');
    console.log('📱 L\'utilisateur +1234567890 a accès au plan Essentiel pendant 120 jours');
    console.log('🔗 Allez sur: https://ijamboenglish.netlify.app/diagnostic');

    await client.end();
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
