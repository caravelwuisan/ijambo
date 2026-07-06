-- ============================================================
-- IJAMBO English — Migration 0001 : schéma complet (§7)
-- ============================================================

-- ---------- Identité ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique not null,
  first_name text not null default '',
  last_name text not null default '',
  email text,
  role text not null default 'student' check (role in ('student', 'coach', 'admin')),
  goal text,
  target_exam_date date,
  locale text not null default 'fr',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

-- Création automatique du profil à l'inscription (metadata passées par le client)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone, first_name, last_name, email, goal, target_exam_date, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone, ''),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'real_email', ''),
    nullif(new.raw_user_meta_data ->> 'goal', ''),
    nullif(new.raw_user_meta_data ->> 'target_exam_date', '')::date,
    coalesce(new.raw_user_meta_data ->> 'locale', 'fr')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Contenu pédagogique ----------
create table public.passages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audio_url text
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('qcm', 'qcm_multiple', 'gap_fill', 'ordering', 'audio_qcm')),
  section text not null check (section in ('grammar', 'reading', 'listening', 'writing', 'speaking')),
  difficulty int not null default 1 check (difficulty between 1 and 5),
  stem_fr text not null,
  stem_en text,
  passage_id uuid references public.passages (id) on delete set null,
  audio_url text,
  options jsonb not null default '[]'::jsonb,
  correct jsonb not null default '[]'::jsonb,
  explanation_fr text,
  explanation_en text,
  weight numeric not null default 1,
  -- auto-évaluations (correct = []) : points attribués par index d'option choisi
  scoring_map jsonb,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index questions_section_idx on public.questions (section, status);
create index questions_tags_idx on public.questions using gin (tags);

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('diagnostic', 'quiz_lecon', 'section_practice')),
  duration_min int,
  question_rules jsonb,
  question_ids uuid[],
  scoring jsonb,
  is_active boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un seul diagnostic actif à la fois (interrupteur §6.3)
create unique index tests_one_active_diagnostic
  on public.tests (kind) where (kind = 'diagnostic' and is_active);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target text not null check (target in ('toefl', 'ielts', 'det')),
  sections jsonb not null default '[]'::jsonb, -- [{name, duration_min, question_ids|rules, order, instructions_fr, instructions_en}]
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target text not null default 'toefl',
  description text,
  duration_weeks int,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort int not null default 0
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,
  icon text,
  sort int not null default 0
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  title text not null,
  body_md text,
  audio_url text,
  quiz_test_id uuid references public.tests (id) on delete set null,
  pass_threshold int not null default 70,
  est_minutes int,
  sort int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived'))
);
create index lessons_module_idx on public.lessons (module_id, sort);

-- ---------- Offre commerciale ----------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_bif int not null,
  access_days int not null default 120,
  features jsonb not null default '{}'::jsonb,
  course_ids uuid[] not null default '{}',
  exam_quota int not null default 0,
  coaching_sessions int not null default 0,
  is_active boolean not null default true,
  sort int not null default 0
);

-- ---------- Activité étudiant ----------
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  course_id uuid references public.courses (id),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'suspended')),
  created_at timestamptz not null default now()
);
create index enrollments_user_idx on public.enrollments (user_id, status);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  test_id uuid references public.tests (id) on delete set null,
  exam_id uuid references public.exams (id) on delete set null,
  kind text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  answers jsonb not null default '{}'::jsonb,
  raw_score numeric,
  section_scores jsonb,
  cefr text,
  projected_score int,
  -- état de reprise (question courante, ordre des questions tirées, fin du timer)
  state jsonb not null default '{}'::jsonb
);
create index attempts_user_idx on public.attempts (user_id, kind);

create table public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  completed_at timestamptz,
  quiz_score int,
  primary key (user_id, lesson_id)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  section text not null check (section in ('writing', 'speaking')),
  content text,
  audio_url text,
  status text not null default 'queued' check (status in ('queued', 'in_review', 'corrected')),
  assigned_coach uuid references public.profiles (id) on delete set null,
  score int check (score between 0 and 30),
  feedback text,
  corrected_at timestamptz,
  created_at timestamptz not null default now()
);
create index submissions_coach_idx on public.submissions (assigned_coach, status);

-- ---------- Paiements ----------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  reference text unique not null,
  amount_bif int not null,
  channel text not null default 'lumicash' check (channel in ('lumicash', 'card', 'manual')),
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'manual_review', 'rejected', 'expired')),
  sms_raw text,
  note text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index payments_status_idx on public.payments (status, created_at);

-- ---------- Coaching ----------
create table public.coaching_slots (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  duration_min int not null default 60,
  capacity int not null default 1,
  topic text,
  status text not null default 'open' check (status in ('open', 'cancelled', 'done')),
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.coaching_slots (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'booked' check (status in ('booked', 'cancelled', 'attended', 'no_show')),
  created_at timestamptz not null default now(),
  unique (slot_id, user_id)
);

-- ---------- Système ----------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null
);

-- updated_at automatique
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger questions_touch before update on public.questions
  for each row execute function public.touch_updated_at();
create trigger tests_touch before update on public.tests
  for each row execute function public.touch_updated_at();
create trigger exams_touch before update on public.exams
  for each row execute function public.touch_updated_at();

-- ---------- Storage : buckets audio (public) et submissions (privé) ----------
insert into storage.buckets (id, name, public) values
  ('audio', 'audio', true),
  ('submissions', 'submissions', false)
on conflict (id) do nothing;
