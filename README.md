# IJAMBO English — PWA de préparation TOEFL/IELTS/DET

Application construite d'après `cahier-des-charges-ijambo.md` et la maquette `maquette-ijambo-english.html`.

## Stack

React + Vite + TypeScript · Tailwind CSS v4 · vite-plugin-pwa · Supabase (Postgres, Auth, Storage, RLS, Edge Functions).

## Démarrage

```bash
npm install
cp .env.example .env   # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev
```

## Base de données Supabase

1. Créer un projet sur supabase.com (plan gratuit).
2. Exécuter dans l'ordre, via le SQL Editor ou `supabase db push` :
   - `supabase/migrations/0001_schema.sql` — tables §7 + buckets Storage
   - `supabase/migrations/0002_rls.sql` — Row Level Security
   - `supabase/migrations/0003_functions.sql` — triggers paiement, RPC admin, streak
3. Seeds de démonstration : `supabase/seed.sql` (généré depuis les banques JSON par
   `node scripts/generate-seed.mjs` — relancer si les banques changent).
4. **Auth** : dans Authentication → Providers → Email, désactiver « Confirm email »
   (l'identifiant principal est le téléphone ; l'email d'auth est technique :
   `<numéro>@phone.ijambo.bi`).

### Créer le premier admin

S'inscrire dans l'app, puis dans le SQL Editor :

```sql
update public.profiles set role = 'admin' where phone = '+257XXXXXXXX';
```

(Idem avec `role = 'coach'` pour un coach.)

## Edge Function paiements (n8n → Supabase, §9)

```bash
supabase functions deploy verify-payment --no-verify-jwt
supabase secrets set VERIFY_PAYMENT_SECRET=<secret partagé avec n8n>
```

n8n envoie `POST /functions/v1/verify-payment` avec le header `x-webhook-secret`
et le corps `{ amount_bif, payer_phone?, operator_ref?, motif?, sms_raw }`.
La correspondance se fait d'abord par code de référence à 6 caractères dans le
motif/SMS, sinon par montant exact + fenêtre 30 min + unicité ; toute ambiguïté
passe le(s) paiement(s) en `manual_review`. L'expiration des `pending` > 24 h
s'exécute via le cron n8n : `select public.expire_pending_payments();`.

## Structure

```
src/
  i18n/          dictionnaires fr.json / en.json + provider
  lib/           supabase, auth, types, scoring (§8), markdown
  components/    ui partagée (collines, pills, cartes…)
  pages/         parcours étudiant (écrans 5.1 → 5.9)
  admin/         back-office (§6) — accès roles admin/coach
supabase/
  migrations/    0001 schéma · 0002 RLS · 0003 fonctions
  seed.sql       démo : 70 questions, diagnostic V1, formation TOEFL, plans
  functions/verify-payment/  Edge Function appelée par n8n
scripts/generate-seed.mjs    régénère seed.sql depuis les banques JSON
```

## Budget performance (§2)

Bundle initial < 300 Ko gzippé (vérifié : ~110 Ko vendor+supabase), pages en
lazy-loading, service worker : cache assets + leçons consultées + audios
(streaming progressif), page hors-ligne dégradée.
