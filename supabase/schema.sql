-- Task Scheduler schema. Run in Supabase dashboard > SQL Editor.
-- Safe to re-run, and keeps existing data.
--
-- WARNING: this app has no sign-in. Anyone with the site's address or its public key can
-- read, change and delete every row in these tables.

-- user_id is no longer used. It is kept so rows made while sign-in existed keep their owner.
create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid,
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
  user_id    uuid,
  name       text not null check (char_length(btrim(name)) between 1 and 30),
  slot       smallint check (slot in (1, 2)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The rule behind a repeating task. Its occurrences are ordinary rows in tasks.
-- generated_through means a deleted occurrence is never created again.
create table if not exists public.task_series (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid,
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

-- Undo the per-account setup on databases created while sign-in existed.
alter table public.tasks alter column user_id drop not null, alter column user_id drop default;
alter table public.labels alter column user_id drop not null, alter column user_id drop default;
alter table public.task_series alter column user_id drop not null, alter column user_id drop default;

-- Deleting an old account must not delete the tasks it made.
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

drop index if exists public.tasks_user_date_idx;
drop index if exists public.tasks_user_completed_idx;
drop index if exists public.labels_user_name_idx;

create index if not exists tasks_date_idx on public.tasks (scheduled_date);
create index if not exists tasks_completed_idx on public.tasks (completed_at desc) where completed_at is not null;
create unique index if not exists labels_name_idx on public.labels (lower(btrim(name)));

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

-- Open access: see the warning at the top of this file.
alter table public.tasks enable row level security;
alter table public.labels enable row level security;
alter table public.task_series enable row level security;

drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;
drop policy if exists "labels_all_own" on public.labels;
drop policy if exists "task_series_all_own" on public.task_series;

drop policy if exists "tasks_open" on public.tasks;
create policy "tasks_open" on public.tasks for all to anon, authenticated using (true) with check (true);

drop policy if exists "labels_open" on public.labels;
create policy "labels_open" on public.labels for all to anon, authenticated using (true) with check (true);

drop policy if exists "task_series_open" on public.task_series;
create policy "task_series_open" on public.task_series for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.tasks, public.labels, public.task_series to anon, authenticated;

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
