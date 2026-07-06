-- ============================================================
-- IJAMBO English — Migration 0002 : Row Level Security (§7)
-- ============================================================

-- Helpers : rôle courant (security definer pour éviter la récursion RLS sur profiles)
create or replace function public.current_role()
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon')
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$ select public.current_role() = 'admin' $$;

create or replace function public.is_staff()
returns boolean language sql stable as $$ select public.current_role() in ('admin', 'coach') $$;

-- Enrollment actif de l'utilisateur courant
create or replace function public.has_active_enrollment()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.enrollments
    where user_id = auth.uid() and status = 'active' and expires_at > now()
  )
$$;

-- Compteur public d'étudiants inscrits (preuve sociale écran 5.1, lisible sans session)
create or replace function public.public_student_count()
returns bigint
language sql stable security definer set search_path = public
as $$
  select count(*) from public.profiles where role = 'student'
$$;
grant execute on function public.public_student_count() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.passages enable row level security;
alter table public.questions enable row level security;
alter table public.tests enable row level security;
alter table public.exams enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.plans enable row level security;
alter table public.enrollments enable row level security;
alter table public.attempts enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.submissions enable row level security;
alter table public.payments enable row level security;
alter table public.coaching_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.audit_log enable row level security;
alter table public.app_settings enable row level security;

-- ---------- profiles ----------
create policy "profiles: soi-même en lecture" on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy "profiles: soi-même en écriture (sans changer de rôle)" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles p where p.id = auth.uid()));
create policy "profiles: admin update" on public.profiles
  for update using (public.is_admin());

-- ---------- contenu pédagogique ----------
-- Lecture : contenu publié pour tout utilisateur authentifié (l'accès aux formations
-- payantes est contrôlé au niveau leçons via l'enrollment) ; staff voit tout.
create policy "questions: publiées lisibles" on public.questions
  for select using (status = 'published' or public.is_staff());
create policy "questions: admin écrit" on public.questions
  for all using (public.is_admin()) with check (public.is_admin());

create policy "passages: lisibles authentifiés" on public.passages
  for select using (auth.uid() is not null);
create policy "passages: admin écrit" on public.passages
  for all using (public.is_admin()) with check (public.is_admin());

create policy "tests: publiés lisibles" on public.tests
  for select using (status = 'published' or public.is_staff());
create policy "tests: admin écrit" on public.tests
  for all using (public.is_admin()) with check (public.is_admin());

create policy "exams: publiés lisibles si enrollment" on public.exams
  for select using ((status = 'published' and public.has_active_enrollment()) or public.is_staff());
create policy "exams: admin écrit" on public.exams
  for all using (public.is_admin()) with check (public.is_admin());

create policy "courses: publiés lisibles" on public.courses
  for select using (status = 'published' or public.is_staff());
create policy "courses: admin écrit" on public.courses
  for all using (public.is_admin()) with check (public.is_admin());

create policy "modules: lisibles" on public.modules
  for select using (auth.uid() is not null);
create policy "modules: admin écrit" on public.modules
  for all using (public.is_admin()) with check (public.is_admin());

-- Les leçons publiées ne sont lisibles que si l'étudiant a un enrollment actif
create policy "lessons: publiées lisibles si enrollment" on public.lessons
  for select using ((status = 'published' and public.has_active_enrollment()) or public.is_staff());
create policy "lessons: admin écrit" on public.lessons
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- offre ----------
create policy "plans: actifs publics" on public.plans
  for select using (is_active or public.is_admin());
create policy "plans: admin écrit" on public.plans
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- activité étudiant ----------
create policy "enrollments: les siens" on public.enrollments
  for select using (user_id = auth.uid() or public.is_staff());
create policy "enrollments: admin écrit" on public.enrollments
  for all using (public.is_admin()) with check (public.is_admin());

create policy "attempts: les siens" on public.attempts
  for select using (user_id = auth.uid() or public.is_staff());
create policy "attempts: créer les siens" on public.attempts
  for insert with check (user_id = auth.uid());
create policy "attempts: modifier les siens" on public.attempts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "attempts: admin" on public.attempts
  for all using (public.is_admin()) with check (public.is_admin());

create policy "lesson_progress: le sien" on public.lesson_progress
  for select using (user_id = auth.uid() or public.is_staff());
create policy "lesson_progress: écrire le sien" on public.lesson_progress
  for insert with check (user_id = auth.uid());
create policy "lesson_progress: modifier le sien" on public.lesson_progress
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- submissions : étudiant crée/voit les siennes, coach ses assignées ----------
create policy "submissions: les siennes" on public.submissions
  for select using (
    user_id = auth.uid()
    or assigned_coach = auth.uid()
    or public.is_admin()
  );
create policy "submissions: créer les siennes" on public.submissions
  for insert with check (user_id = auth.uid());
create policy "submissions: coach corrige ses assignées" on public.submissions
  for update using (assigned_coach = auth.uid() or public.is_admin())
  with check (assigned_coach = auth.uid() or public.is_admin());

-- ---------- payments : lecture seule côté étudiant ; insert pending pour soi ----------
create policy "payments: les siens en lecture" on public.payments
  for select using (user_id = auth.uid() or public.is_admin());
create policy "payments: créer un pending pour soi" on public.payments
  for insert with check (user_id = auth.uid() and status = 'pending');
create policy "payments: admin écrit" on public.payments
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------- coaching ----------
create policy "slots: ouverts lisibles" on public.coaching_slots
  for select using (auth.uid() is not null);
create policy "slots: coach gère les siens" on public.coaching_slots
  for all using (coach_id = auth.uid() or public.is_admin())
  with check (coach_id = auth.uid() or public.is_admin());

create policy "bookings: les siennes + coach du créneau" on public.bookings
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.coaching_slots s where s.id = slot_id and s.coach_id = auth.uid())
  );
create policy "bookings: réserver pour soi" on public.bookings
  for insert with check (user_id = auth.uid());
create policy "bookings: annuler les siennes" on public.bookings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "bookings: coach marque présence" on public.bookings
  for update using (
    public.is_admin()
    or exists (select 1 from public.coaching_slots s where s.id = slot_id and s.coach_id = auth.uid())
  );

-- ---------- système ----------
create policy "audit: admin lit" on public.audit_log
  for select using (public.is_admin());
create policy "audit: staff écrit" on public.audit_log
  for insert with check (public.is_staff());

create policy "settings: lisibles authentifiés" on public.app_settings
  for select using (true); -- textes d'accueil nécessaires sur l'écran public
create policy "settings: admin écrit" on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Storage ----------
create policy "audio public en lecture" on storage.objects
  for select using (bucket_id = 'audio');
create policy "audio: admin upload" on storage.objects
  for insert with check (bucket_id = 'audio' and public.is_admin());
create policy "audio: admin update" on storage.objects
  for update using (bucket_id = 'audio' and public.is_admin());
create policy "audio: admin delete" on storage.objects
  for delete using (bucket_id = 'audio' and public.is_admin());

-- submissions : l'étudiant dépose dans son dossier <uid>/..., coach+admin lisent
create policy "submissions storage: upload dans son dossier" on storage.objects
  for insert with check (
    bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "submissions storage: lecture proprio/staff" on storage.objects
  for select using (
    bucket_id = 'submissions'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );
