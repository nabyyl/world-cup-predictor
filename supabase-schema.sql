-- Office World Cup Predictor - Supabase SQL setup
-- Run this in Supabase > SQL Editor > New query > Run.
--
-- This version includes:
-- match scoring:
--   Exact score = 5 points
--   Correct winner / correct draw = 2 points
--   Correct first team to score = 1 point
--   Maximum match points = 8 points
-- bonus scoring:
--   Tournament winner = 10 points
--   Tournament best player = 10 points
--   Finalists = 5 points each, max 10 points
-- user supported-team customization,
-- team supporter summary,
-- who-will-win prediction linked to the 2-point correct winner/draw rule,
-- first-team-to-score prediction without "No goal" option for users,
-- Super Admin final predictions export,
-- Super Admin active users export,
-- match email notification tracking,
-- admin unlock override,
-- admin score protection,
-- super admin role,
-- limited admin review access,
-- prediction audit history,
-- admin review views,
-- FIFA match number and knockout source tracking,
-- Super Admin match replacement protection,
-- bonus prediction controls,
-- approved office users,
-- and profile activation fix.

create extension if not exists pgcrypto;

-- =========================================================
-- TABLES
-- =========================================================

create table if not exists public.allowed_users (
  email text primary key,
  full_name text not null,
  role text not null default 'user',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'user',
  status text not null default 'pending' check (status in ('active', 'pending', 'inactive')),
  supported_team text,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),

  -- FIFA / schedule identity
  external_id text unique,
  match_no int,
  source text not null default 'manual',
  source_url text,

  -- Fixture details
  home_team text not null,
  away_team text not null,
  stage text,
  venue text,
  kickoff_at timestamptz not null,

  -- Knockout auto-fill sources
  -- Example: {"type":"winner","match_no":89}
  home_source jsonb,
  away_source jsonb,

  -- Lock/result controls
  is_locked boolean not null default false,
  admin_override_open boolean not null default false,
  actual_home_score int check (actual_home_score >= 0),
  actual_away_score int check (actual_away_score >= 0),

  -- Actual first team to score:
  -- home = home team scored first
  -- away = away team scored first
  -- none = no goal / 0-0 actual result
  actual_first_team_to_score text check (actual_first_team_to_score in ('home', 'away', 'none')),

  result_source text not null default 'manual',
  admin_result_override boolean not null default false,
  auto_result_synced_at timestamptz,
  last_synced_at timestamptz,

  created_at timestamptz not null default now()
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,

  home_score int not null check (home_score >= 0),
  away_score int not null check (away_score >= 0),

  -- Who will win prediction:
  -- home = home team wins
  -- away = away team wins
  -- draw = match ends in draw
  -- This drives the 2-point correct winner / draw rule.
  who_will_win text check (who_will_win in ('home', 'away', 'draw')),

  -- First team to score prediction:
  -- home = user predicts home team scores first
  -- away = user predicts away team scores first
  -- Users no longer select "none"; if they expect 0-0, they enter 0-0 as score and choose Draw for who_will_win.
  first_team_to_score text check (first_team_to_score in ('home', 'away')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, match_id)
);

create table if not exists public.prediction_audit (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid,
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,

  home_score int not null check (home_score >= 0),
  away_score int not null check (away_score >= 0),
  who_will_win text check (who_will_win in ('home', 'away', 'draw')),
  first_team_to_score text check (first_team_to_score in ('home', 'away')),

  action text not null check (action in ('insert', 'update')),
  created_at timestamptz not null default now()
);

-- User bonus predictions
create table if not exists public.bonus_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tournament_winner text,
  best_player text,
  finalist_one text,
  finalist_two text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- Super Admin bonus control/results
-- Single-row table. id = true.
create table if not exists public.bonus_results (
  id boolean primary key default true,
  is_locked boolean not null default false,

  actual_tournament_winner text,
  actual_best_player text,
  actual_finalist_one text,
  actual_finalist_two text,

  updated_at timestamptz not null default now(),

  constraint bonus_results_single_row check (id = true)
);

-- Email notification tracking.
-- Used by Supabase Edge Function / scheduled job to avoid duplicate match reminders.
create table if not exists public.match_email_notifications (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  notification_type text not null default 'match_30_min_reminder',
  sent_at timestamptz not null default now(),
  unique (match_id, user_id, notification_type)
);

-- Ensure one default bonus control row exists.
insert into public.bonus_results (id, is_locked)
values (true, false)
on conflict (id) do nothing;

-- =========================================================
-- SAFE UPGRADE LINES
-- =========================================================

alter table public.profiles add column if not exists supported_team text;

alter table public.matches add column if not exists external_id text;
alter table public.matches add column if not exists match_no int;
alter table public.matches add column if not exists source text not null default 'manual';
alter table public.matches add column if not exists source_url text;
alter table public.matches add column if not exists venue text;
alter table public.matches add column if not exists home_source jsonb;
alter table public.matches add column if not exists away_source jsonb;
alter table public.matches add column if not exists admin_override_open boolean not null default false;
alter table public.matches add column if not exists last_synced_at timestamptz;
alter table public.matches add column if not exists result_source text not null default 'manual';
alter table public.matches add column if not exists admin_result_override boolean not null default false;
alter table public.matches add column if not exists auto_result_synced_at timestamptz;
alter table public.matches add column if not exists actual_first_team_to_score text;

alter table public.predictions add column if not exists who_will_win text;
alter table public.predictions add column if not exists first_team_to_score text;

alter table public.prediction_audit add column if not exists who_will_win text;
alter table public.prediction_audit add column if not exists first_team_to_score text;

alter table public.bonus_predictions add column if not exists tournament_winner text;
alter table public.bonus_predictions add column if not exists best_player text;
alter table public.bonus_predictions add column if not exists finalist_one text;
alter table public.bonus_predictions add column if not exists finalist_two text;
alter table public.bonus_predictions add column if not exists updated_at timestamptz not null default now();

alter table public.bonus_results add column if not exists is_locked boolean not null default false;
alter table public.bonus_results add column if not exists actual_tournament_winner text;
alter table public.bonus_results add column if not exists actual_best_player text;
alter table public.bonus_results add column if not exists actual_finalist_one text;
alter table public.bonus_results add column if not exists actual_finalist_two text;
alter table public.bonus_results add column if not exists updated_at timestamptz not null default now();

alter table public.match_email_notifications add column if not exists notification_type text not null default 'match_30_min_reminder';

-- Clean old user-side "none" first-team-to-score picks before applying new user constraint.
-- Actual match result can still use actual_first_team_to_score = 'none' for 0-0.
update public.predictions
set first_team_to_score = null
where first_team_to_score = 'none';

update public.prediction_audit
set first_team_to_score = null
where first_team_to_score = 'none';

-- Auto-fill who_will_win for older predictions based on score, if missing.
update public.predictions
set who_will_win =
  case
    when home_score > away_score then 'home'
    when home_score < away_score then 'away'
    else 'draw'
  end
where who_will_win is null;

update public.prediction_audit
set who_will_win =
  case
    when home_score > away_score then 'home'
    when home_score < away_score then 'away'
    else 'draw'
  end
where who_will_win is null;

-- Drop old check constraints if rerunning.
alter table public.matches drop constraint if exists matches_actual_first_team_to_score_check;
alter table public.predictions drop constraint if exists predictions_first_team_to_score_check;
alter table public.predictions drop constraint if exists predictions_who_will_win_check;
alter table public.prediction_audit drop constraint if exists prediction_audit_first_team_to_score_check;
alter table public.prediction_audit drop constraint if exists prediction_audit_who_will_win_check;
alter table public.match_email_notifications drop constraint if exists match_email_notifications_notification_type_check;

alter table public.matches
add constraint matches_actual_first_team_to_score_check
check (actual_first_team_to_score in ('home', 'away', 'none'));

alter table public.predictions
add constraint predictions_first_team_to_score_check
check (first_team_to_score in ('home', 'away'));

alter table public.predictions
add constraint predictions_who_will_win_check
check (who_will_win in ('home', 'away', 'draw'));

alter table public.prediction_audit
add constraint prediction_audit_first_team_to_score_check
check (first_team_to_score in ('home', 'away'));

alter table public.prediction_audit
add constraint prediction_audit_who_will_win_check
check (who_will_win in ('home', 'away', 'draw'));

alter table public.match_email_notifications
add constraint match_email_notifications_notification_type_check
check (notification_type in ('match_30_min_reminder'));

-- Unique external_id when present.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_external_id_key'
  ) then
    alter table public.matches
    add constraint matches_external_id_key unique (external_id);
  end if;
end $$;

-- Unique match_no when present.
-- Multiple null values are allowed.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_match_no_unique'
  ) then
    alter table public.matches
    add constraint matches_match_no_unique unique (match_no);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'match_email_notifications_match_id_user_id_notification_type_key'
  ) then
    alter table public.match_email_notifications
    add constraint match_email_notifications_match_id_user_id_notification_type_key
    unique (match_id, user_id, notification_type);
  end if;
end $$;

create index if not exists idx_matches_home_source_match_no
on public.matches ((home_source->>'match_no'));

create index if not exists idx_matches_away_source_match_no
on public.matches ((away_source->>'match_no'));

create index if not exists idx_matches_match_no
on public.matches (match_no);

create index if not exists idx_matches_kickoff_at
on public.matches (kickoff_at);

create index if not exists idx_predictions_user_id
on public.predictions (user_id);

create index if not exists idx_predictions_match_id
on public.predictions (match_id);

create index if not exists idx_predictions_who_will_win
on public.predictions (who_will_win);

create index if not exists idx_bonus_predictions_user_id
on public.bonus_predictions (user_id);

create index if not exists idx_profiles_supported_team
on public.profiles (supported_team);

create index if not exists idx_match_email_notifications_match_user
on public.match_email_notifications (match_id, user_id);

-- =========================================================
-- ROLE CHECK CONSTRAINTS
-- user = normal user
-- admin = limited admin review access
-- super_admin = full system access
-- =========================================================

alter table public.allowed_users
drop constraint if exists allowed_users_role_check;

alter table public.allowed_users
add constraint allowed_users_role_check
check (role in ('user', 'admin', 'super_admin'));

alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (role in ('user', 'admin', 'super_admin'));

alter table public.matches
drop constraint if exists matches_result_source_check;

alter table public.matches
add constraint matches_result_source_check
check (result_source in ('manual', 'auto', 'admin'));

-- =========================================================
-- ACCESS FUNCTIONS
-- =========================================================

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
      and status = 'active'
  );
$$;

create or replace function public.has_admin_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'super_admin')
      and status = 'active'
  );
$$;

-- Backward compatibility.
-- In this structure, is_admin means full Super Admin controls.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin();
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'active'
  );
$$;

-- Users update only their own supported team through this RPC.
-- This avoids giving normal users full profile update rights.
create or replace function public.update_my_supported_team(team_name text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  update public.profiles
  set supported_team = nullif(trim(team_name), '')
  where id = auth.uid()
    and status = 'active'
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Active profile not found.';
  end if;

  return updated_profile;
end;
$$;

grant execute on function public.update_my_supported_team(text) to authenticated;

-- =========================================================
-- SCORING FUNCTIONS
-- =========================================================

create or replace function public.predicted_winner_from_scores(
  pred_home int,
  pred_away int
)
returns text
language sql
immutable
as $$
  select
    case
      when pred_home > pred_away then 'home'
      when pred_home < pred_away then 'away'
      else 'draw'
    end;
$$;

create or replace function public.actual_winner_from_scores(
  actual_home int,
  actual_away int
)
returns text
language sql
immutable
as $$
  select
    case
      when actual_home is null or actual_away is null then null
      when actual_home > actual_away then 'home'
      when actual_home < actual_away then 'away'
      else 'draw'
    end;
$$;

create or replace function public.exact_score_points(
  pred_home int,
  pred_away int,
  actual_home int,
  actual_away int
)
returns int
language sql
immutable
as $$
  select
    case
      when actual_home is null or actual_away is null then 0
      when pred_home = actual_home and pred_away = actual_away then 5
      else 0
    end;
$$;

create or replace function public.who_will_win_points(
  pred_winner text,
  actual_home int,
  actual_away int
)
returns int
language sql
immutable
as $$
  select
    case
      when actual_home is null or actual_away is null then 0
      when pred_winner is not null
       and pred_winner = public.actual_winner_from_scores(actual_home, actual_away)
      then 2
      else 0
    end;
$$;

-- Backward compatibility name.
-- result_points now means Exact Score Points + Who Will Win Points.
create or replace function public.match_result_points(
  pred_home int,
  pred_away int,
  actual_home int,
  actual_away int
)
returns int
language sql
immutable
as $$
  select
    public.exact_score_points(pred_home, pred_away, actual_home, actual_away)
    +
    public.who_will_win_points(
      public.predicted_winner_from_scores(pred_home, pred_away),
      actual_home,
      actual_away
    );
$$;

create or replace function public.first_score_points(
  pred_first text,
  actual_first text
)
returns int
language sql
immutable
as $$
  select
    case
      when pred_first is not null
       and actual_first is not null
       and pred_first = actual_first
       and actual_first <> 'none'
      then 1
      else 0
    end;
$$;

create or replace function public.bonus_prediction_points(
  pred_tournament_winner text,
  pred_best_player text,
  pred_finalist_one text,
  pred_finalist_two text,
  actual_tournament_winner text,
  actual_best_player text,
  actual_finalist_one text,
  actual_finalist_two text
)
returns int
language plpgsql
immutable
as $$
declare
  total int := 0;
  pred_f1 text := lower(trim(coalesce(pred_finalist_one, '')));
  pred_f2 text := lower(trim(coalesce(pred_finalist_two, '')));
  actual_f1 text := lower(trim(coalesce(actual_finalist_one, '')));
  actual_f2 text := lower(trim(coalesce(actual_finalist_two, '')));
begin
  -- Tournament winner = 10
  if lower(trim(coalesce(pred_tournament_winner, ''))) <> ''
     and lower(trim(coalesce(pred_tournament_winner, ''))) = lower(trim(coalesce(actual_tournament_winner, ''))) then
    total := total + 10;
  end if;

  -- Tournament best player = 10
  if lower(trim(coalesce(pred_best_player, ''))) <> ''
     and lower(trim(coalesce(pred_best_player, ''))) = lower(trim(coalesce(actual_best_player, ''))) then
    total := total + 10;
  end if;

  -- Finalists = 5 each, order does not matter.
  -- Prevent duplicate user finalist picks from scoring twice for one actual finalist.
  if pred_f1 <> '' and (pred_f1 = actual_f1 or pred_f1 = actual_f2) then
    total := total + 5;
  end if;

  if pred_f2 <> ''
     and pred_f2 <> pred_f1
     and (pred_f2 = actual_f1 or pred_f2 = actual_f2) then
    total := total + 5;
  end if;

  return total;
end;
$$;

-- =========================================================
-- SUPER ADMIN MATCH REPLACEMENT FUNCTION
-- Replaces old matches with new FIFA portal schedule ONLY IF
-- no predictions exist.
-- =========================================================

create or replace function public.super_admin_replace_matches_from_json(schedule_data jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  prediction_count int;
  inserted_count int;
  invalid_kickoff_count int;
begin
  if not public.is_super_admin() then
    raise exception 'Only Super Admin can replace the match schedule.';
  end if;

  select count(*) into prediction_count
  from public.predictions;

  if prediction_count > 0 then
    raise exception 'Cannot replace matches because predictions already exist. Delete/review predictions first if you really need to reset.';
  end if;

  if schedule_data is null
     or jsonb_typeof(schedule_data) <> 'object'
     or jsonb_typeof(schedule_data->'matches') <> 'array' then
    raise exception 'Invalid schedule JSON. Expected an object with a matches array.';
  end if;

  select count(*) into invalid_kickoff_count
  from jsonb_to_recordset(schedule_data->'matches') as x (
    kickoff_at text
  )
  where x.kickoff_at is null
     or trim(x.kickoff_at) = '';

  if invalid_kickoff_count > 0 then
    raise exception 'Invalid schedule JSON. Every match must include kickoff_at.';
  end if;

  delete from public.matches;

  insert into public.matches (
    external_id,
    match_no,
    source,
    source_url,
    home_team,
    away_team,
    stage,
    venue,
    kickoff_at,
    home_source,
    away_source,
    actual_home_score,
    actual_away_score,
    actual_first_team_to_score,
    result_source,
    admin_result_override,
    last_synced_at
  )
  select
    coalesce(x.external_id, 'fifa-2026-m' || lpad(coalesce(x.match_no, row_number() over ())::text, 3, '0')),
    x.match_no,
    coalesce(x.source, 'fifa_manual_portal'),
    coalesce(x.source_url, schedule_data->>'source_url'),
    coalesce(nullif(x.home_team, ''), 'TBD'),
    coalesce(nullif(x.away_team, ''), 'TBD'),
    coalesce(nullif(x.stage, ''), 'World Cup'),
    nullif(x.venue, ''),
    x.kickoff_at::timestamptz,
    x.home_source,
    x.away_source,
    x.actual_home_score,
    x.actual_away_score,
    x.actual_first_team_to_score,
    coalesce(x.result_source, 'manual'),
    coalesce(x.admin_result_override, false),
    now()
  from jsonb_to_recordset(schedule_data->'matches') as x (
    external_id text,
    match_no int,
    source text,
    source_url text,
    home_team text,
    away_team text,
    stage text,
    venue text,
    kickoff_at text,
    home_source jsonb,
    away_source jsonb,
    actual_home_score int,
    actual_away_score int,
    actual_first_team_to_score text,
    result_source text,
    admin_result_override boolean
  );

  get diagnostics inserted_count = row_count;

  return inserted_count;
end;
$$;

grant execute on function public.super_admin_replace_matches_from_json(jsonb) to authenticated;

-- =========================================================
-- NEW USER PROFILE TRIGGER
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed record;
begin
  select * into allowed
  from public.allowed_users
  where lower(email) = lower(new.email);

  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    lower(new.email),
    coalesce(allowed.full_name, new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(allowed.role, 'user'),
    case when allowed.email is not null and allowed.is_active then 'active' else 'pending' end
  )
  on conflict (id)
  do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    status = excluded.status;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- PREDICTION AUDIT TRIGGER
-- =========================================================

create or replace function public.log_prediction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.prediction_audit (
    prediction_id,
    user_id,
    match_id,
    home_score,
    away_score,
    who_will_win,
    first_team_to_score,
    action
  )
  values (
    new.id,
    new.user_id,
    new.match_id,
    new.home_score,
    new.away_score,
    coalesce(
      new.who_will_win,
      public.predicted_winner_from_scores(new.home_score, new.away_score)
    ),
    new.first_team_to_score,
    case when tg_op = 'INSERT' then 'insert' else 'update' end
  );

  return new;
end;
$$;

drop trigger if exists prediction_audit_trigger on public.predictions;

create trigger prediction_audit_trigger
after insert or update on public.predictions
for each row execute procedure public.log_prediction_change();

-- =========================================================
-- ENABLE RLS
-- =========================================================

alter table public.allowed_users enable row level security;
alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.prediction_audit enable row level security;
alter table public.bonus_predictions enable row level security;
alter table public.bonus_results enable row level security;
alter table public.match_email_notifications enable row level security;

-- =========================================================
-- DROP OLD POLICIES
-- =========================================================

drop policy if exists "Admins can read allowed users" on public.allowed_users;
drop policy if exists "Admins can manage allowed users" on public.allowed_users;
drop policy if exists "Super admins can read allowed users" on public.allowed_users;
drop policy if exists "Super admins can manage allowed users" on public.allowed_users;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;
drop policy if exists "Super admins can update profiles" on public.profiles;

drop policy if exists "Active users can view matches" on public.matches;
drop policy if exists "Admins can insert matches" on public.matches;
drop policy if exists "Admins can update matches" on public.matches;
drop policy if exists "Admins can delete matches" on public.matches;
drop policy if exists "Super admins can insert matches" on public.matches;
drop policy if exists "Super admins can update matches" on public.matches;
drop policy if exists "Super admins can delete matches" on public.matches;

drop policy if exists "Users can view own predictions and admins can view all" on public.predictions;
drop policy if exists "Users can insert own open-match predictions" on public.predictions;
drop policy if exists "Users can update own open-match predictions" on public.predictions;
drop policy if exists "Admins can manage predictions" on public.predictions;
drop policy if exists "Super admins can manage predictions" on public.predictions;

drop policy if exists "Admins can view prediction audit" on public.prediction_audit;
drop policy if exists "Users can view own prediction audit" on public.prediction_audit;

drop policy if exists "Users can view own bonus predictions and admins can view all" on public.bonus_predictions;
drop policy if exists "Users can insert own open bonus predictions" on public.bonus_predictions;
drop policy if exists "Users can update own open bonus predictions" on public.bonus_predictions;
drop policy if exists "Super admins can manage bonus predictions" on public.bonus_predictions;

drop policy if exists "Active users can view bonus results" on public.bonus_results;
drop policy if exists "Super admins can manage bonus results" on public.bonus_results;

drop policy if exists "Super admins can view email notifications" on public.match_email_notifications;
drop policy if exists "Super admins can manage email notifications" on public.match_email_notifications;

-- =========================================================
-- RLS POLICIES
-- =========================================================

create policy "Super admins can read allowed users"
on public.allowed_users for select
to authenticated
using (public.is_super_admin());

create policy "Super admins can manage allowed users"
on public.allowed_users for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.has_admin_access());

create policy "Super admins can update profiles"
on public.profiles for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "Active users can view matches"
on public.matches for select
to authenticated
using (public.is_active_user());

create policy "Super admins can insert matches"
on public.matches for insert
to authenticated
with check (public.is_super_admin());

create policy "Super admins can update matches"
on public.matches for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "Super admins can delete matches"
on public.matches for delete
to authenticated
using (public.is_super_admin());

create policy "Users can view own predictions and admins can view all"
on public.predictions for select
to authenticated
using (user_id = auth.uid() or public.has_admin_access());

create policy "Users can insert own open-match predictions"
on public.predictions for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.is_locked = false
      and (m.kickoff_at > now() or m.admin_override_open = true)
  )
);

create policy "Users can update own open-match predictions"
on public.predictions for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.is_locked = false
      and (m.kickoff_at > now() or m.admin_override_open = true)
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.is_locked = false
      and (m.kickoff_at > now() or m.admin_override_open = true)
  )
);

create policy "Super admins can manage predictions"
on public.predictions for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "Admins can view prediction audit"
on public.prediction_audit for select
to authenticated
using (public.has_admin_access());

create policy "Users can view own prediction audit"
on public.prediction_audit for select
to authenticated
using (user_id = auth.uid());

-- Bonus predictions
create policy "Users can view own bonus predictions and admins can view all"
on public.bonus_predictions for select
to authenticated
using (user_id = auth.uid() or public.has_admin_access());

create policy "Users can insert own open bonus predictions"
on public.bonus_predictions for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.bonus_results br
    where br.id = true
      and br.is_locked = false
  )
);

create policy "Users can update own open bonus predictions"
on public.bonus_predictions for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.bonus_results br
    where br.id = true
      and br.is_locked = false
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.bonus_results br
    where br.id = true
      and br.is_locked = false
  )
);

create policy "Super admins can manage bonus predictions"
on public.bonus_predictions for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Bonus results
create policy "Active users can view bonus results"
on public.bonus_results for select
to authenticated
using (public.is_active_user());

create policy "Super admins can manage bonus results"
on public.bonus_results for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Email notification logs
create policy "Super admins can view email notifications"
on public.match_email_notifications for select
to authenticated
using (public.is_super_admin());

create policy "Super admins can manage email notifications"
on public.match_email_notifications for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- =========================================================
-- DROP VIEWS BEFORE RECREATING
-- Required because view column structure/order changed
-- =========================================================

drop view if exists public.reminder_eligible_users;
drop view if exists public.active_users_export;
drop view if exists public.final_predictions_export;
drop view if exists public.supporter_summary;
drop view if exists public.bonus_prediction_review;
drop view if exists public.match_prediction_history;
drop view if exists public.match_prediction_review;
drop view if exists public.predictions_export;
drop view if exists public.leaderboard;

-- =========================================================
-- LEADERBOARD VIEW
-- =========================================================

create or replace view public.leaderboard as
with match_scores as (
  select
    pr.user_id,
    count(pr.id)::int as predictions_count,

    sum(public.exact_score_points(
      pr.home_score,
      pr.away_score,
      m.actual_home_score,
      m.actual_away_score
    ))::int as exact_score_points,

    sum(public.who_will_win_points(
      coalesce(pr.who_will_win, public.predicted_winner_from_scores(pr.home_score, pr.away_score)),
      m.actual_home_score,
      m.actual_away_score
    ))::int as who_will_win_points,

    sum(
      public.exact_score_points(
        pr.home_score,
        pr.away_score,
        m.actual_home_score,
        m.actual_away_score
      )
      +
      public.who_will_win_points(
        coalesce(pr.who_will_win, public.predicted_winner_from_scores(pr.home_score, pr.away_score)),
        m.actual_home_score,
        m.actual_away_score
      )
    )::int as result_points,

    sum(public.first_score_points(
      pr.first_team_to_score,
      m.actual_first_team_to_score
    ))::int as first_score_points,

    sum(
      public.exact_score_points(
        pr.home_score,
        pr.away_score,
        m.actual_home_score,
        m.actual_away_score
      )
      +
      public.who_will_win_points(
        coalesce(pr.who_will_win, public.predicted_winner_from_scores(pr.home_score, pr.away_score)),
        m.actual_home_score,
        m.actual_away_score
      )
      +
      public.first_score_points(
        pr.first_team_to_score,
        m.actual_first_team_to_score
      )
    )::int as match_points,

    sum(
      case
        when m.actual_home_score is not null
         and m.actual_away_score is not null
         and pr.home_score = m.actual_home_score
         and pr.away_score = m.actual_away_score
        then 1
        else 0
      end
    )::int as exact_scores,

    sum(
      case
        when m.actual_home_score is not null
         and m.actual_away_score is not null
         and coalesce(pr.who_will_win, public.predicted_winner_from_scores(pr.home_score, pr.away_score))
             = public.actual_winner_from_scores(m.actual_home_score, m.actual_away_score)
        then 1
        else 0
      end
    )::int as correct_results,

    sum(
      case
        when pr.first_team_to_score is not null
         and m.actual_first_team_to_score is not null
         and pr.first_team_to_score = m.actual_first_team_to_score
         and m.actual_first_team_to_score <> 'none'
        then 1
        else 0
      end
    )::int as correct_first_scores

  from public.predictions pr
  join public.matches m on m.id = pr.match_id
  group by pr.user_id
),

bonus_scores as (
  select
    bp.user_id,
    public.bonus_prediction_points(
      bp.tournament_winner,
      bp.best_player,
      bp.finalist_one,
      bp.finalist_two,
      br.actual_tournament_winner,
      br.actual_best_player,
      br.actual_finalist_one,
      br.actual_finalist_two
    )::int as bonus_points
  from public.bonus_predictions bp
  cross join public.bonus_results br
  where br.id = true
)

select
  p.id as user_id,
  p.full_name,
  p.email,
  p.supported_team,

  coalesce(ms.predictions_count, 0)::int as predictions_count,

  coalesce(ms.match_points, 0)::int as match_points,
  coalesce(bs.bonus_points, 0)::int as bonus_points,

  (
    coalesce(ms.match_points, 0)
    +
    coalesce(bs.bonus_points, 0)
  )::int as total_points,

  coalesce(ms.result_points, 0)::int as result_points,
  coalesce(ms.exact_score_points, 0)::int as exact_score_points,
  coalesce(ms.who_will_win_points, 0)::int as who_will_win_points,
  coalesce(ms.first_score_points, 0)::int as first_score_points,

  coalesce(ms.exact_scores, 0)::int as exact_scores,
  coalesce(ms.correct_results, 0)::int as correct_results,
  coalesce(ms.correct_first_scores, 0)::int as correct_first_scores

from public.profiles p
left join match_scores ms on ms.user_id = p.id
left join bonus_scores bs on bs.user_id = p.id
where p.status = 'active';

grant select on public.leaderboard to authenticated;

-- =========================================================
-- SUPPORTER SUMMARY VIEW
-- Active users can see team support counts.
-- =========================================================

create or replace view public.supporter_summary as
select
  supported_team,
  count(*)::int as supporters_count,
  string_agg(full_name, ', ' order by full_name) as supporter_names
from public.profiles
where status = 'active'
  and supported_team is not null
  and trim(supported_team) <> ''
group by supported_team
order by supporters_count desc, supported_team asc;

grant select on public.supporter_summary to authenticated;

-- =========================================================
-- PREDICTIONS EXPORT VIEW
-- Visible to admin/super_admin and own user.
-- =========================================================

create or replace view public.predictions_export as
select
  pr.id,
  pr.user_id,
  p.full_name,
  p.email,
  p.supported_team,

  m.match_no,
  m.home_team,
  m.away_team,
  m.stage,
  m.venue,
  m.kickoff_at,

  pr.home_score,
  pr.away_score,
  coalesce(pr.who_will_win, public.predicted_winner_from_scores(pr.home_score, pr.away_score)) as who_will_win,
  pr.first_team_to_score,

  m.actual_home_score,
  m.actual_away_score,
  public.actual_winner_from_scores(m.actual_home_score, m.actual_away_score) as actual_winner,
  m.actual_first_team_to_score,

  public.exact_score_points(
    pr.home_score,
    pr.away_score,
    m.actual_home_score,
    m.actual_away_score
  ) as exact_score_points,

  public.who_will_win_points(
    coalesce(pr.who_will_win, public.predicted_winner_from_scores(pr.home_score, pr.away_score)),
    m.actual_home_score,
    m.actual_away_score
  ) as who_will_win_points,

  (
    public.exact_score_points(
      pr.home_score,
      pr.away_score,
      m.actual_home_score,
      m.actual_away_score
    )
    +
    public.who_will_win_points(
      coalesce(pr.who_will_win, public.predicted_winner_from_scores(pr.home_score, pr.away_score)),
      m.actual_home_score,
      m.actual_away_score
    )
  ) as result_points,

  public.first_score_points(
    pr.first_team_to_score,
    m.actual_first_team_to_score
  ) as first_score_points,

  (
    public.exact_score_points(
      pr.home_score,
      pr.away_score,
      m.actual_home_score,
      m.actual_away_score
    )
    +
    public.who_will_win_points(
      coalesce(pr.who_will_win, public.predicted_winner_from_scores(pr.home_score, pr.away_score)),
      m.actual_home_score,
      m.actual_away_score
    )
    +
    public.first_score_points(
      pr.first_team_to_score,
      m.actual_first_team_to_score
    )
  ) as match_points,

  pr.updated_at
from public.predictions pr
join public.profiles p on p.id = pr.user_id
join public.matches m on m.id = pr.match_id
where public.has_admin_access() or pr.user_id = auth.uid();

grant select on public.predictions_export to authenticated;

-- =========================================================
-- FINAL PREDICTIONS EXPORT VIEW
-- Super Admin export for final predictions and match scores.
-- =========================================================

create or replace view public.final_predictions_export as
select
  m.match_no,
  m.stage,
  m.venue,
  m.kickoff_at,

  m.home_team,
  m.away_team,

  m.actual_home_score,
  m.actual_away_score,
  public.actual_winner_from_scores(m.actual_home_score, m.actual_away_score) as actual_winner,
  m.actual_first_team_to_score,

  p.full_name,
  p.email,
  p.supported_team,

  pr.home_score as predicted_home_score,
  pr.away_score as predicted_away_score,
  coalesce(pr.who_will_win, public.predicted_winner_from_scores(pr.home_score, pr.away_score)) as who_will_win,
  pr.first_team_to_score,

  public.exact_score_points(
    pr.home_score,
    pr.away_score,
    m.actual_home_score,
    m.actual_away_score
  ) as exact_score_points,

  public.who_will_win_points(
    coalesce(pr.who_will_win, public.predicted_winner_from_scores(pr.home_score, pr.away_score)),
    m.actual_home_score,
    m.actual_away_score
  ) as who_will_win_points,

  public.first_score_points(
    pr.first_team_to_score,
    m.actual_first_team_to_score
  ) as first_score_points,

  (
    public.exact_score_points(
      pr.home_score,
      pr.away_score,
      m.actual_home_score,
      m.actual_away_score
    )
    +
    public.who_will_win_points(
      coalesce(pr.who_will_win, public.predicted_winner_from_scores(pr.home_score, pr.away_score)),
      m.actual_home_score,
      m.actual_away_score
    )
    +
    public.first_score_points(
      pr.first_team_to_score,
      m.actual_first_team_to_score
    )
  ) as total_match_points,

  pr.updated_at
from public.predictions pr
join public.profiles p on p.id = pr.user_id
join public.matches m on m.id = pr.match_id
where public.is_super_admin();

grant select on public.final_predictions_export to authenticated;

-- =========================================================
-- ACTIVE USERS EXPORT VIEW
-- Super Admin export for active user data.
-- =========================================================

create or replace view public.active_users_export as
select
  p.id as user_id,
  p.full_name,
  p.email,
  p.role,
  p.status,
  p.supported_team,
  p.created_at,

  coalesce(lb.predictions_count, 0)::int as total_predictions,

  case
    when bp.id is not null then true
    else false
  end as bonus_prediction_submitted,

  coalesce(lb.match_points, 0)::int as match_points,
  coalesce(lb.bonus_points, 0)::int as bonus_points,
  coalesce(lb.total_points, 0)::int as total_points

from public.profiles p
left join public.leaderboard lb on lb.user_id = p.id
left join public.bonus_predictions bp on bp.user_id = p.id
where public.is_super_admin()
  and p.status = 'active'
order by p.full_name asc, p.email asc;

grant select on public.active_users_export to authenticated;

-- =========================================================
-- ADMIN REVIEW VIEW
-- Shows latest prediction and points per match
-- =========================================================

create or replace view public.match_prediction_review as
select
  pr.id as prediction_id,
  pr.user_id,
  pr.match_id,

  p.full_name,
  p.email,
  p.supported_team,

  m.match_no,
  m.home_team,
  m.away_team,
  m.stage,
  m.venue,
  m.kickoff_at,

  m.actual_home_score,
  m.actual_away_score,
  public.actual_winner_from_scores(m.actual_home_score, m.actual_away_score) as actual_winner,
  m.actual_first_team_to_score,

  pr.home_score,
  pr.away_score,
  coalesce(pr.who_will_win, public.predicted_winner_from_scores(pr.home_score, pr.away_score)) as who_will_win,
  pr.first_team_to_score,
  pr.updated_at,

  public.exact_score_points(
    pr.home_score,
    pr.away_score,
    m.actual_home_score,
    m.actual_away_score
  ) as exact_score_points,

  public.who_will_win_points(
    coalesce(pr.who_will_win, public.predicted_winner_from_scores(pr.home_score, pr.away_score)),
    m.actual_home_score,
    m.actual_away_score
  ) as who_will_win_points,

  (
    public.exact_score_points(
      pr.home_score,
      pr.away_score,
      m.actual_home_score,
      m.actual_away_score
    )
    +
    public.who_will_win_points(
      coalesce(pr.who_will_win, public.predicted_winner_from_scores(pr.home_score, pr.away_score)),
      m.actual_home_score,
      m.actual_away_score
    )
  ) as result_points,

  public.first_score_points(
    pr.first_team_to_score,
    m.actual_first_team_to_score
  ) as first_score_points,

  (
    public.exact_score_points(
      pr.home_score,
      pr.away_score,
      m.actual_home_score,
      m.actual_away_score
    )
    +
    public.who_will_win_points(
      coalesce(pr.who_will_win, public.predicted_winner_from_scores(pr.home_score, pr.away_score)),
      m.actual_home_score,
      m.actual_away_score
    )
    +
    public.first_score_points(
      pr.first_team_to_score,
      m.actual_first_team_to_score
    )
  ) as match_points

from public.predictions pr
join public.profiles p on p.id = pr.user_id
join public.matches m on m.id = pr.match_id
where public.has_admin_access();

grant select on public.match_prediction_review to authenticated;

-- =========================================================
-- ADMIN HISTORY VIEW
-- Shows every prediction change recorded in audit
-- =========================================================

create or replace view public.match_prediction_history as
select
  pa.id,
  pa.prediction_id,
  pa.user_id,
  pa.match_id,

  p.full_name,
  p.email,
  p.supported_team,

  m.match_no,
  m.home_team,
  m.away_team,
  m.stage,

  pa.home_score,
  pa.away_score,
  coalesce(pa.who_will_win, public.predicted_winner_from_scores(pa.home_score, pa.away_score)) as who_will_win,
  pa.first_team_to_score,

  pa.action,
  pa.created_at
from public.prediction_audit pa
join public.profiles p on p.id = pa.user_id
join public.matches m on m.id = pa.match_id
where public.has_admin_access();

grant select on public.match_prediction_history to authenticated;

-- =========================================================
-- BONUS PREDICTION REVIEW VIEW
-- Admin/Super Admin can review all bonus predictions
-- =========================================================

create or replace view public.bonus_prediction_review as
select
  bp.id,
  bp.user_id,

  p.full_name,
  p.email,
  p.supported_team,

  bp.tournament_winner,
  bp.best_player,
  bp.finalist_one,
  bp.finalist_two,

  br.is_locked,
  br.actual_tournament_winner,
  br.actual_best_player,
  br.actual_finalist_one,
  br.actual_finalist_two,

  public.bonus_prediction_points(
    bp.tournament_winner,
    bp.best_player,
    bp.finalist_one,
    bp.finalist_two,
    br.actual_tournament_winner,
    br.actual_best_player,
    br.actual_finalist_one,
    br.actual_finalist_two
  ) as bonus_points,

  bp.updated_at
from public.bonus_predictions bp
join public.profiles p on p.id = bp.user_id
cross join public.bonus_results br
where br.id = true
  and public.has_admin_access();

grant select on public.bonus_prediction_review to authenticated;

-- =========================================================
-- REMINDER ELIGIBLE USERS VIEW
-- For Supabase Edge Function / scheduled email reminders.
-- This view returns active users for matches starting soon.
-- The Edge Function should query this view and send emails.
-- =========================================================

create or replace view public.reminder_eligible_users as
select
  m.id as match_id,
  m.match_no,
  m.home_team,
  m.away_team,
  m.stage,
  m.venue,
  m.kickoff_at,

  p.id as user_id,
  p.full_name,
  p.email,
  p.supported_team

from public.matches m
cross join public.profiles p
left join public.match_email_notifications men
  on men.match_id = m.id
 and men.user_id = p.id
 and men.notification_type = 'match_30_min_reminder'

where p.status = 'active'
  and p.email is not null
  and m.kickoff_at > now()
  and m.kickoff_at <= now() + interval '35 minutes'
  and m.kickoff_at >= now() + interval '25 minutes'
  and men.id is null;

grant select on public.reminder_eligible_users to authenticated;

-- =========================================================
-- APPROVED USERS
-- Add office users here.
-- Only emails added here can create/use accounts.
-- =========================================================

insert into public.allowed_users (email, full_name, role, is_active)
values ('leeban89@gmail.com', 'Ibrahim Nabeel Ali', 'super_admin', true)
on conflict (email)
do update set
  full_name = excluded.full_name,
  role = 'super_admin',
  is_active = true;

update public.profiles
set
  full_name = 'Ibrahim Nabeel Ali',
  role = 'super_admin',
  status = 'active'
where lower(email) = 'leeban89@gmail.com';

insert into public.allowed_users (email, full_name, role, is_active)
values
('ismail.wikram@pension.gov.mv', 'Ismail Wikram Nafees', 'super_admin', true),
('ibrahim.naail@pension.gov.mv', 'Ibrahim Naail Najmee', 'admin', true),
('mohamed.ahzam@pension.gov.mv', 'Mohamed Ahzam', 'admin', true)
on conflict (email)
do update set
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = true;

insert into public.allowed_users (email, full_name, role, is_active)
values
('thalhath.moosa@pension.gov.mv', 'Thalhath Moosa', 'user', true),
('mohamed.naseeh@pension.gov.mv', 'Mohamed Naseeh', 'user', true)
on conflict (email)
do update set
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = true;

update public.profiles p
set
  status = 'active',
  role = au.role,
  full_name = coalesce(nullif(p.full_name, ''), au.full_name)
from public.allowed_users au
where lower(p.email) = lower(au.email)
  and au.is_active = true;
