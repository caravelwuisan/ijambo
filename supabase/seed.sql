-- ============================================================
-- IJAMBO English — seed.sql (données de démonstration)
-- ============================================================

-- ---------- Paramètres app ----------
insert into public.app_settings (key, value) values
  ('lumicash_merchant_code', '{"label": "IJAMBO", "code": "40217", "ussd": "*163#"}'::jsonb),
  ('whatsapp_numbers', '{"support": "+25779000000", "admin": "+25779000001"}'::jsonb),
  ('det_threshold', '60'::jsonb),
  ('home_stats', '{"questions": "200+", "mock_tests": "4", "max_data": "2 Go"}'::jsonb),
  ('live_session_links', '{}'::jsonb),
  ('home_texts', '{"fr": {"greeting": "Amahoro! 👋", "sub": "Découvrez votre niveau réel en 25 minutes et recevez votre plan de préparation personnalisé jusqu''au jour de l''examen."}, "en": {"greeting": "Amahoro! 👋", "sub": "Discover your real level in 25 minutes and receive your personalised preparation plan all the way to exam day."}}'::jsonb),
  ('diagnostic_unlocks', '[]'::jsonb)
on conflict (key) do update set value = excluded.value;

-- ---------- Formules tarifaires ----------
insert into public.plans (name, price_bif, access_days, features, course_ids, exam_quota, coaching_sessions, is_active, sort) values
  (
    'Essentiel',
    75000,
    120,
    '{"fr": ["Programme personnalisé complet (4 sections)", "200+ questions avec corrigés en français", "2 tests blancs chronométrés", "Suivi de progression semaine par semaine"], "en": ["Full personalised programme (4 sections)", "200+ questions with French explanations", "2 timed mock tests", "Week-by-week progress tracking"]}'::jsonb,
    '{}',
    2,
    0,
    true,
    0
  ),
  (
    'Accompagné',
    150000,
    120,
    '{"fr": ["Tout le pack Essentiel", "4 tests blancs + analyses détaillées", "Sessions live de groupe chaque semaine", "Correction individuelle Writing & Speaking"], "en": ["Everything in Essentiel", "4 mock tests + detailed analysis", "Weekly live group sessions", "Individual Writing & Speaking correction"], "highlight": true}'::jsonb,
    '{}',
    4,
    0,
    true,
    1
  ),
  (
    'Premium présentiel',
    250000,
    120,
    '{"fr": ["Tout le pack Accompagné", "8 sessions individuelles avec Coach Jacques", "Simulation orale complète en conditions réelles", "Aide au dossier de bourse (relecture CV/lettre)"], "en": ["Everything in Accompagné", "8 individual sessions with Coach Jacques", "Full oral simulation in real conditions", "Scholarship file support (CV/letter review)"]}'::jsonb,
    '{}',
    4,
    8,
    true,
    2
  );

-- ---------- Test diagnostic factice (à remplacer par vos données réelles) ----------
-- Pour charger vos questions réelles :
-- 1. Utilisez le back-office /admin/questions → Importer JSON
-- 2. Ou exécutez le script supabase/seed.sql généré par generate-seed.mjs
-- 3. Mettez à jour les UUIDs du test diagnostic ci-dessous

insert into public.tests (id, name, kind, duration_min, question_ids, scoring, is_active, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'Diagnostic IJAMBO English — V1',
  'diagnostic',
  25,
  '{}',
  '{"total_points": 100, "bands": [{"min": 0, "max": 29, "cefr": "A2", "toefl_range": [30, 45], "program_weeks": 16}, {"min": 30, "max": 49, "cefr": "B1-", "toefl_range": [46, 60], "program_weeks": 12}, {"min": 50, "max": 64, "cefr": "B1+", "toefl_range": [61, 75], "program_weeks": 10}, {"min": 65, "max": 79, "cefr": "B2", "toefl_range": [76, 90], "program_weeks": 8}, {"min": 80, "max": 100, "cefr": "C1", "toefl_range": [91, 110], "program_weeks": 5}], "det_recommendation_threshold": 60}'::jsonb,
  true,
  'published'
);

-- ---------- Formation TOEFL démo ----------
insert into public.courses (id, name, target, description, duration_weeks, status, sort)
values (
  '10000000-0000-0000-0000-000000000001',
  'Programme TOEFL 10 semaines',
  'toefl',
  'Programme complet de préparation au TOEFL iBT pour francophones : Listening, Reading, Writing, Speaking et stratégie d''examen.',
  10,
  'published',
  0
);

insert into public.modules (id, course_id, name, icon, sort) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Listening', '🎧', 0),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Reading', '📖', 1),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Writing', '✍️', 2),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Speaking', '🗣', 3);

insert into public.lessons (module_id, title, body_md, pass_threshold, est_minutes, sort, status) values
  ('20000000-0000-0000-0000-000000000001', 'Comprendre les conversations campus', '# Listening : conversations\n\nRepérez la situation, le problème et la solution dans une conversation étudiante type TOEFL.\n\n## Méthode\n\n- Écoutez attentivement la première phrase\n- Identifiez rapidement le problème\n- Écoutez la solution\n\n**Conseil** : les réponses reprennent souvent les mots clés du début.', 70, 15, 0, 'published'),
  ('20000000-0000-0000-0000-000000000002', 'Trouver l''idée principale', '# Reading : idée principale\n\nDistinguez l''idée centrale des détails de support — le piège n°1 du TOEFL Reading.\n\n## Technique\n\n1. Lisez le titre et le premier paragraphe\n2. Identifiez le sujet en 5 mots max\n3. Vérifiez avec le dernier paragraphe\n\n**Astuce** : l''idée principale est rarement répétée mot pour mot.', 70, 15, 0, 'published');

-- ---------- Examen blanc factice ----------
insert into public.exams (id, name, target, sections, status)
values (
  '30000000-0000-0000-0000-000000000001',
  'Test blanc TOEFL n°1',
  'toefl',
  '[
    {"name": "Reading", "duration_min": 35, "rules": [{"section": "reading", "count": 8}], "order": 0, "instructions_fr": "2 passages académiques. Vous pouvez revenir en arrière dans la section.", "instructions_en": "2 academic passages. You may go back within the section."},
    {"name": "Listening", "duration_min": 36, "rules": [{"section": "listening", "count": 8}], "order": 1, "instructions_fr": "Conversations et extraits de cours. Une seule écoute par audio.", "instructions_en": "Conversations and lecture excerpts. One listen per audio."},
    {"name": "Writing", "duration_min": 29, "rules": [{"section": "writing", "count": 1}], "order": 2, "instructions_fr": "Rédigez votre essai dans la zone de texte. Correction par votre coach sous 48 h.", "instructions_en": "Write your essay in the text area. Corrected by your coach within 48 h."},
    {"name": "Speaking", "duration_min": 16, "rules": [{"section": "speaking", "count": 1}], "order": 3, "instructions_fr": "Enregistrez votre réponse (45 s de préparation, 45 s de parole).", "instructions_en": "Record your answer (45 s preparation, 45 s speaking)."}
  ]'::jsonb,
  'published'
);

-- ============================================================
-- ⚠️ TODO : Charger vos données réelles
-- ============================================================
--
-- 1. Back-office /admin/questions → Importer JSON
--    Uploader diagnostic-ijambo-v1.json et banque-quiz-lecons-v1.json
--    (ou exécuter le script generate-seed.mjs s'il existe)
--
-- 2. /admin/courses → Ajouter/modifier modules et leçons
--
-- 3. /admin/exams → Charger vos sections et règles d'examen
--
-- Les données ci-dessus (formules, test factice, cours vide) suffisent
-- pour démarrer l'app. Le reste se fait via le back-office.
