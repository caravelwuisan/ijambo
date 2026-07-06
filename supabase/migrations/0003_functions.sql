-- ============================================================
-- IJAMBO English — Migration 0003 : logique serveur paiements & inscriptions
-- ============================================================

-- À la vérification d'un paiement (webhook n8n via Edge Function, ou admin),
-- activation immédiate du plan : création de l'enrollment (§5.5).
create or replace function public.on_payment_verified()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  p record;
  cid uuid;
begin
  if new.status = 'verified' and old.status is distinct from 'verified' then
    new.verified_at := coalesce(new.verified_at, now());
    select * into p from public.plans where id = new.plan_id;
    -- une inscription par cours associé au plan (ou une générique si aucun)
    if p.course_ids is null or array_length(p.course_ids, 1) is null then
      insert into public.enrollments (user_id, plan_id, course_id, starts_at, expires_at, status)
      values (new.user_id, new.plan_id, null, now(), now() + make_interval(days => p.access_days), 'active');
    else
      foreach cid in array p.course_ids loop
        insert into public.enrollments (user_id, plan_id, course_id, starts_at, expires_at, status)
        values (new.user_id, new.plan_id, cid, now(), now() + make_interval(days => p.access_days), 'active');
      end loop;
    end if;
    insert into public.audit_log (actor_id, action, entity, entity_id, payload)
    values (null, 'payment_verified', 'payments', new.id::text,
            jsonb_build_object('reference', new.reference, 'channel', new.channel, 'amount_bif', new.amount_bif));
  end if;
  return new;
end;
$$;

create trigger payments_verified
  before update on public.payments
  for each row execute function public.on_payment_verified();

-- Action admin : passer un paiement manual_review → verified/rejected avec note (§6.6)
create or replace function public.admin_set_payment_status(
  p_payment_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin uniquement';
  end if;
  if p_status not in ('verified', 'rejected') then
    raise exception 'statut invalide';
  end if;
  update public.payments set status = p_status, note = coalesce(p_note, note)
  where id = p_payment_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, payload)
  values (auth.uid(), 'admin_payment_' || p_status, 'payments', p_payment_id::text,
          jsonb_build_object('note', p_note));
end;
$$;

-- Expiration des pending > 24 h (appelée par le cron n8n, §9)
create or replace function public.expire_pending_payments()
returns int
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  update public.payments set status = 'expired'
  where status = 'pending' and created_at < now() - interval '24 hours';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Repassage du diagnostic : gratuit une fois, puis après 30 jours ou déblocage admin (§5.3)
create or replace function public.can_take_diagnostic(p_user uuid default auth.uid())
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare last_finished timestamptz;
begin
  select max(finished_at) into last_finished
  from public.attempts
  where user_id = p_user and kind = 'diagnostic' and finished_at is not null;
  if last_finished is null then return true; end if;
  if last_finished < now() - interval '30 days' then return true; end if;
  -- déblocage admin : app_settings['diagnostic_unlocks'] = liste d'uuid
  return exists (
    select 1 from public.app_settings
    where key = 'diagnostic_unlocks' and value ? p_user::text
  );
end;
$$;
grant execute on function public.can_take_diagnostic to authenticated;

-- Déblocage admin d'un repassage (§6.6)
create or replace function public.admin_unlock_diagnostic(p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin uniquement'; end if;
  insert into public.app_settings (key, value)
  values ('diagnostic_unlocks', jsonb_build_array(p_user::text))
  on conflict (key) do update
    set value = (
      select jsonb_agg(distinct e) from jsonb_array_elements(app_settings.value || jsonb_build_array(p_user::text)) e
    );
  insert into public.audit_log (actor_id, action, entity, entity_id)
  values (auth.uid(), 'unlock_diagnostic', 'profiles', p_user::text);
end;
$$;

-- Streak de jours consécutifs (dashboard 5.6) : basé sur lesson_progress + attempts
create or replace function public.current_streak(p_user uuid default auth.uid())
returns int
language plpgsql stable security definer set search_path = public
as $$
declare
  n int := 0;
  d date := current_date;
begin
  -- le streak court encore si activité aujourd'hui ou hier
  if not exists (
    select 1 from (
      select date_trunc('day', completed_at)::date as day from public.lesson_progress
        where user_id = p_user and completed_at is not null
      union
      select date_trunc('day', started_at)::date from public.attempts where user_id = p_user
    ) a where a.day in (current_date, current_date - 1)
  ) then
    return 0;
  end if;
  if not exists (
    select 1 from (
      select date_trunc('day', completed_at)::date as day from public.lesson_progress
        where user_id = p_user and completed_at is not null
      union
      select date_trunc('day', started_at)::date from public.attempts where user_id = p_user
    ) a where a.day = current_date
  ) then
    d := current_date - 1;
  end if;
  loop
    exit when not exists (
      select 1 from (
        select date_trunc('day', completed_at)::date as day from public.lesson_progress
          where user_id = p_user and completed_at is not null
        union
        select date_trunc('day', started_at)::date from public.attempts where user_id = p_user
      ) a where a.day = d
    );
    n := n + 1;
    d := d - 1;
  end loop;
  return n;
end;
$$;
grant execute on function public.current_streak to authenticated;

-- Indicateurs du tableau de bord admin (§6.1) — une seule requête
create or replace function public.admin_dashboard_stats()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when not public.is_staff() then '{}'::jsonb else jsonb_build_object(
    'signups_today', (select count(*) from public.profiles where created_at >= current_date),
    'signups_30d', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    'diags_today', (select count(*) from public.attempts where kind = 'diagnostic' and started_at >= current_date),
    'diags_30d', (select count(*) from public.attempts where kind = 'diagnostic' and started_at >= now() - interval '30 days'),
    'conversion_30d', (
      select case when d = 0 then 0 else round(100.0 * p / d, 1) end
      from (
        select
          (select count(distinct user_id) from public.attempts
            where kind = 'diagnostic' and started_at >= now() - interval '30 days') as d,
          (select count(distinct user_id) from public.payments
            where status = 'verified' and created_at >= now() - interval '30 days') as p
      ) x
    ),
    'revenue_30d', (
      select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
        select pl.name || ' · ' || pay.channel as k, sum(pay.amount_bif) as v
        from public.payments pay join public.plans pl on pl.id = pay.plan_id
        where pay.status = 'verified' and pay.created_at >= now() - interval '30 days'
        group by 1
      ) r(k, v)
    ),
    'revenue_total_30d', (
      select coalesce(sum(amount_bif), 0) from public.payments
      where status = 'verified' and created_at >= now() - interval '30 days'
    ),
    'manual_review', (select count(*) from public.payments where status = 'manual_review'),
    'active_students', (
      select count(distinct user_id) from public.enrollments
      where status = 'active' and expires_at > now()
    ),
    'pending_corrections', (select count(*) from public.submissions where status in ('queued','in_review'))
  ) end
$$;
grant execute on function public.admin_dashboard_stats to authenticated;
