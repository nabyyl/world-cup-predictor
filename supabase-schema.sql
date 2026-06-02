-- Office World Cup Predictor - Supabase SQL setup
-- Run this in Supabase > SQL Editor > New query > Run.
-- This version includes internet schedule sync fields and admin unlock override.

create extension if not exists pgcrypto;

create table if not exists public.allowed_users (
  email text primary key,
  full_name text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'pending' check (status in ('active', 'pending', 'inactive')),
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  source text not null default 'manual',
  source_url text,
  home_team text not null,
  away_team text not null,
  stage text,
  venue text,
  kickoff_at timestamptz not null,
  is_locked boolean not null default false,
  admin_override_open boolean not null default false,
  actual_home_score int check (actual_home_score >= 0),
  actual_away_score int check (actual_away_score >= 0),
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- Safe upgrade lines if you already ran the old schema.
alter table public.matches add column if not exists external_id text unique;
alter table public.matches add column if not exists source text not null default 'manual';
alter table public.matches add column if not exists source_url text;
alter table public.matches add column if not exists venue text;
alter table public.matches add column if not exists admin_override_open boolean not null default false;
alter table public.matches add column if not exists last_synced_at timestamptz;

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_score int not null check (home_score >= 0),
  away_score int not null check (away_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

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
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.allowed_users enable row level security;
alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

-- Drop old policies before recreating them, so upgrades do not fail.
drop policy if exists "Admins can read allowed users" on public.allowed_users;
drop policy if exists "Admins can manage allowed users" on public.allowed_users;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;
drop policy if exists "Active users can view matches" on public.matches;
drop policy if exists "Admins can insert matches" on public.matches;
drop policy if exists "Admins can update matches" on public.matches;
drop policy if exists "Admins can delete matches" on public.matches;
drop policy if exists "Users can view own predictions and admins can view all" on public.predictions;
drop policy if exists "Users can insert own open-match predictions" on public.predictions;
drop policy if exists "Users can update own open-match predictions" on public.predictions;
drop policy if exists "Admins can manage predictions" on public.predictions;

-- allowed_users: only admins can manage approved office users
create policy "Admins can read allowed users"
on public.allowed_users for select
to authenticated
using (public.is_admin());

create policy "Admins can manage allowed users"
on public.allowed_users for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- profiles: users can read themselves; admins can read/manage all profiles
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy "Admins can update profiles"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- matches: all active users can see matches; admins can manage matches
create policy "Active users can view matches"
on public.matches for select
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active'));

create policy "Admins can insert matches"
on public.matches for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update matches"
on public.matches for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete matches"
on public.matches for delete
to authenticated
using (public.is_admin());

-- predictions: normal users can submit only before kickoff, unless admin_override_open is true.
-- Admins can see/manage all predictions.
create policy "Users can view own predictions and admins can view all"
on public.predictions for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "Users can insert own open-match predictions"
on public.predictions for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.matches m
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
    select 1 from public.matches m
    where m.id = match_id
      and m.is_locked = false
      and (m.kickoff_at > now() or m.admin_override_open = true)
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and m.is_locked = false
      and (m.kickoff_at > now() or m.admin_override_open = true)
  )
);

create policy "Admins can manage predictions"
on public.predictions for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace view public.leaderboard as
select
  p.id as user_id,
  p.full_name,
  p.email,
  coalesce(count(pr.id), 0)::int as predictions_count,
  coalesce(sum(
    case
      when m.actual_home_score is null or m.actual_away_score is null then 0
      when pr.home_score = m.actual_home_score and pr.away_score = m.actual_away_score then 5
      when (pr.home_score - pr.away_score) = (m.actual_home_score - m.actual_away_score)
           and ((pr.home_score > pr.away_score and m.actual_home_score > m.actual_away_score)
             or (pr.home_score < pr.away_score and m.actual_home_score < m.actual_away_score)
             or (pr.home_score = pr.away_score and m.actual_home_score = m.actual_away_score)) then 4
      when ((pr.home_score > pr.away_score and m.actual_home_score > m.actual_away_score)
         or (pr.home_score < pr.away_score and m.actual_home_score < m.actual_away_score)
         or (pr.home_score = pr.away_score and m.actual_home_score = m.actual_away_score)) then 3
      else 0
    end
  ), 0)::int as total_points,
  coalesce(sum(case when m.actual_home_score is not null and pr.home_score = m.actual_home_score and pr.away_score = m.actual_away_score then 1 else 0 end), 0)::int as exact_scores,
  coalesce(sum(case when m.actual_home_score is not null and ((pr.home_score > pr.away_score and m.actual_home_score > m.actual_away_score) or (pr.home_score < pr.away_score and m.actual_home_score < m.actual_away_score) or (pr.home_score = pr.away_score and m.actual_home_score = m.actual_away_score)) then 1 else 0 end), 0)::int as correct_results
from public.profiles p
left join public.predictions pr on pr.user_id = p.id
left join public.matches m on m.id = pr.match_id
where p.status = 'active'
group by p.id, p.full_name, p.email;

grant select on public.leaderboard to authenticated;

create or replace view public.predictions_export as
select
  pr.id,
  p.full_name,
  p.email,
  m.home_team,
  m.away_team,
  m.stage,
  m.kickoff_at,
  pr.home_score,
  pr.away_score,
  pr.updated_at
from public.predictions pr
join public.profiles p on p.id = pr.user_id
join public.matches m on m.id = pr.match_id
where public.is_admin() or pr.user_id = auth.uid();

grant select on public.predictions_export to authenticated;

-- SAMPLE DATA: edit/remove these after setup.
-- Step 1: put your admin email here BEFORE creating your admin account in the app.
-- insert into public.allowed_users (email, full_name, role) values ('your-email@office.com', 'Your Name', 'admin');

-- Example office users:
-- insert into public.allowed_users (email, full_name, role) values
-- ('staff1@office.com', 'Staff One', 'user'),
-- ('staff2@office.com', 'Staff Two', 'user');

-- Optional manual test matches. You can delete these and use the Admin > Sync Schedule button instead.
insert into public.matches (external_id, source, home_team, away_team, stage, venue, kickoff_at)
values
('sample-001', 'manual', 'Mexico', 'South Africa', 'Group A', 'Mexico City', '2026-06-12 00:00:00+05'),
('sample-002', 'manual', 'Canada', 'TBD', 'Group B', 'Toronto', '2026-06-13 05:00:00+05')
on conflict (external_id) do nothing;
