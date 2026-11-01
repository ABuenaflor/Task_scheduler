-- Task Scheduler schema. Run in Supabase dashboard > SQL Editor.
-- Safe to re-run, and keeps existing data.
--
-- Access works through a 4-digit passcode, created the first time the app is opened.
-- To replace a forgotten passcode, run this in the SQL Editor:  select public.reset_passcode();

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid default auth.uid(),
  title          text not null check (char_length(btrim(title)) between 1 and 200),
  label          text not null,
  urgency        text not null check (urgency in ('low', 'medium', 'high')),
  scheduled_date date not null,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- A custom label's key is its id, so renaming one never touches its tasks.
create table if not exists public.labels (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default auth.uid(),
  name       text not null check (char_length(btrim(name)) between 1 and 30),
  slot       smallint check (slot in (1, 2)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The rule behind a repeating task. Its occurrences are ordinary rows in tasks.
-- generated_through means a deleted occurrence is never created again.
create table if not exists public.task_series (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid default auth.uid(),
  title             text not null check (char_length(btrim(title)) between 1 and 200),
  label             text not null check (char_length(label) between 1 and 64),
  urgency           text not null check (urgency in ('low', 'medium', 'high')),
  due_time          time,
  remind_minutes    integer check (remind_minutes between 0 and 10080),
  recurrence        text not null check (recurrence in ('daily', 'weekly', 'monthly')),
  anchor_date       date not null,
  generated_through date not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- user_id may be empty on rows made while the app had no sign-in, until a passcode claims them.
alter table public.tasks alter column user_id drop not null, alter column user_id set default auth.uid();
alter table public.labels alter column user_id drop not null, alter column user_id set default auth.uid();
alter table public.task_series alter column user_id drop not null, alter column user_id set default auth.uid();

alter table public.tasks drop constraint if exists tasks_user_id_fkey;
alter table public.labels drop constraint if exists labels_user_id_fkey;
alter table public.task_series drop constraint if exists task_series_user_id_fkey;

alter table public.tasks drop constraint if exists tasks_label_check;
alter table public.tasks add constraint tasks_label_check check (char_length(label) between 1 and 64);

alter table public.tasks add column if not exists due_time time;
alter table public.tasks add column if not exists remind_minutes integer check (remind_minutes between 0 and 10080);
alter table public.tasks add column if not exists reminded_at timestamptz;
alter table public.tasks add column if not exists series_id uuid references public.task_series (id) on delete set null;

-- Two devices extending a series at once can never create the same occurrence twice.
alter table public.tasks drop constraint if exists tasks_series_date_key;
alter table public.tasks add constraint tasks_series_date_key unique (series_id, scheduled_date);

drop index if exists public.tasks_date_idx;
drop index if exists public.tasks_completed_idx;
drop index if exists public.labels_name_idx;

create index if not exists tasks_user_date_idx on public.tasks (user_id, scheduled_date);
create index if not exists tasks_user_completed_idx on public.tasks (user_id, completed_at desc)
  where completed_at is not null;
create unique index if not exists labels_user_name_idx on public.labels (user_id, lower(btrim(name)));

-- updated_at is set by the database so every device agrees on which write is newest.
create or replace function public.tasks_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_touch_updated_at on public.tasks;
create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.tasks_touch_updated_at();

drop trigger if exists labels_touch_updated_at on public.labels;
create trigger labels_touch_updated_at
  before update on public.labels
  for each row execute function public.tasks_touch_updated_at();

drop trigger if exists task_series_touch_updated_at on public.task_series;
create trigger task_series_touch_updated_at
  before update on public.task_series
  for each row execute function public.tasks_touch_updated_at();

-- Row Level Security: only the signed-in owner of a row can reach it.
alter table public.tasks enable row level security;
alter table public.labels enable row level security;
alter table public.task_series enable row level security;

drop policy if exists "tasks_open" on public.tasks;
drop policy if exists "labels_open" on public.labels;
drop policy if exists "task_series_open" on public.task_series;
drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;

drop policy if exists "tasks_all_own" on public.tasks;
create policy "tasks_all_own" on public.tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "labels_all_own" on public.labels;
create policy "labels_all_own" on public.labels
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "task_series_all_own" on public.task_series;
create policy "task_series_all_own" on public.task_series
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.tasks, public.labels, public.task_series from anon;
grant select, insert, update, delete on public.tasks, public.labels, public.task_series to authenticated;

-- ---------------------------------------------------------------------------
-- Passcode
--
-- Four digits are only 10,000 guesses, so they can't be the real password: Supabase's
-- sign-in endpoint can be called directly. The account's password is a long random
-- secret instead, and the functions below release it only for the right passcode,
-- counting wrong tries here in the database where they can't be skipped.
-- ---------------------------------------------------------------------------

-- A single row. No policies and no grants: only the functions below can read it.
create table if not exists public.app_passcode (
  singleton       boolean primary key default true check (singleton),
  owner_id        uuid not null,
  owner_email     text not null,
  code_hash       text,
  auth_secret     text not null,
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now()
);

alter table public.app_passcode enable row level security;
revoke all on public.app_passcode from public, anon, authenticated;

create or replace function public.passcode_is_set()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_passcode where code_hash is not null);
$$;

-- The first person to call this sets the passcode, so open the app right after running
-- this file. The account is created directly, so no email is ever sent or confirmed.
create or replace function public.create_passcode(code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_found public.app_passcode;
  owner uuid;
  email text := 'owner@task-scheduler.local';
  secret text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if code is null or code !~ '^[0-9]{4}$' then
    raise exception 'The passcode must be exactly 4 digits.';
  end if;

  perform pg_advisory_xact_lock(hashtext('app_passcode'));
  select * into row_found from public.app_passcode;
  if row_found.code_hash is not null then
    raise exception 'A passcode already exists.';
  end if;

  if row_found.owner_id is not null then
    owner := row_found.owner_id;
    update auth.users
      set encrypted_password = extensions.crypt(secret, extensions.gen_salt('bf')), updated_at = now()
      where id = owner;
  else
    owner := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', owner, 'authenticated', 'authenticated', email,
      extensions.crypt(secret, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), owner, owner::text,
      jsonb_build_object('sub', owner::text, 'email', email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  insert into public.app_passcode (owner_id, owner_email, code_hash, auth_secret)
  values (owner, email, extensions.crypt(code, extensions.gen_salt('bf')), secret)
  on conflict (singleton) do update
    set code_hash = excluded.code_hash, auth_secret = excluded.auth_secret,
        failed_attempts = 0, locked_until = null, updated_at = now();

  -- This app has one owner, so everything already in the database becomes theirs.
  update public.tasks set user_id = owner where user_id is distinct from owner;
  update public.labels set user_id = owner where user_id is distinct from owner;
  update public.task_series set user_id = owner where user_id is distinct from owner;

  return jsonb_build_object('email', email, 'secret', secret);
end;
$$;

-- Returns instead of raising on a wrong code: raising would roll back the failure count.
-- Five free tries, then a lock that starts at 15 minutes and doubles up to a day, which
-- makes guessing all 10,000 codes take years. Devices already unlocked are not affected.
create or replace function public.unlock_with_passcode(code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_found public.app_passcode;
  attempts integer;
  lock_for interval := null;
begin
  perform pg_advisory_xact_lock(hashtext('app_passcode'));
  select * into row_found from public.app_passcode where code_hash is not null;
  if not found then
    return jsonb_build_object('status', 'not_set');
  end if;

  if row_found.locked_until is not null and row_found.locked_until > now() then
    return jsonb_build_object('status', 'locked', 'locked_until', row_found.locked_until);
  end if;

  if code ~ '^[0-9]{4}$' and row_found.code_hash = extensions.crypt(code, row_found.code_hash) then
    update public.app_passcode set failed_attempts = 0, locked_until = null, updated_at = now();
    return jsonb_build_object('status', 'ok', 'email', row_found.owner_email, 'secret', row_found.auth_secret);
  end if;

  attempts := row_found.failed_attempts + 1;
  if attempts >= 5 then
    lock_for := least(interval '15 minutes' * power(2, attempts - 5), interval '24 hours');
  end if;
  update public.app_passcode
    set failed_attempts = attempts,
        locked_until = case when lock_for is null then null else now() + lock_for end,
        updated_at = now();

  if lock_for is null then
    return jsonb_build_object('status', 'wrong', 'attempts_left', 5 - attempts);
  end if;
  return jsonb_build_object('status', 'locked', 'locked_until', now() + lock_for);
end;
$$;

-- For a forgotten passcode. Not available from the app, only from the SQL Editor. Tasks
-- are kept, and every device has to enter the new passcode.
create or replace function public.reset_passcode()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  update public.app_passcode set code_hash = null, failed_attempts = 0, locked_until = null, updated_at = now()
    returning owner_id into owner;
  delete from auth.sessions where user_id = owner;
  return 'Passcode cleared. Open the app to create a new one.';
end;
$$;

-- Supabase lets anon call new functions by default, so every grant here is explicit.
revoke all on function public.passcode_is_set() from public, anon, authenticated;
revoke all on function public.create_passcode(text) from public, anon, authenticated;
revoke all on function public.unlock_with_passcode(text) from public, anon, authenticated;
revoke all on function public.reset_passcode() from public, anon, authenticated;
grant execute on function public.passcode_is_set() to anon, authenticated;
grant execute on function public.create_passcode(text) to anon, authenticated;
grant execute on function public.unlock_with_passcode(text) to anon, authenticated;

-- Live sync between devices.
do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.labels;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.task_series;
exception
  when duplicate_object then null;
end;
$$;
