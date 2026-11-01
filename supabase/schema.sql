-- Task Scheduler schema. Run once in Supabase dashboard > SQL Editor.
-- Safe to re-run.

create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title          text not null check (char_length(btrim(title)) between 1 and 200),
  label          text not null check (label in ('bills', 'work', 'personal', 'health', 'errands', 'other')),
  urgency        text not null check (urgency in ('low', 'medium', 'high')),
  scheduled_date date not null,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists tasks_user_date_idx on public.tasks (user_id, scheduled_date);
create index if not exists tasks_user_completed_idx on public.tasks (user_id, completed_at desc)
  where completed_at is not null;

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

-- Row Level Security: a signed-in user can only ever reach their own rows.
alter table public.tasks enable row level security;

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own" on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own" on public.tasks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own" on public.tasks
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;

-- Live sync between devices.
do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception
  when duplicate_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Custom labels, recurring tasks, reminders. Also safe to re-run.
-- ---------------------------------------------------------------------------

-- A custom label's key is its id, so renaming one never touches its tasks.
create table if not exists public.labels (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 30),
  slot       smallint check (slot in (1, 2)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists labels_user_name_idx on public.labels (user_id, lower(btrim(name)));

-- The rule behind a repeating task. Its occurrences are ordinary rows in tasks.
-- generated_through means a deleted occurrence is never created again.
create table if not exists public.task_series (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
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

alter table public.tasks drop constraint if exists tasks_label_check;
alter table public.tasks add constraint tasks_label_check check (char_length(label) between 1 and 64);

alter table public.tasks add column if not exists due_time time;
alter table public.tasks add column if not exists remind_minutes integer check (remind_minutes between 0 and 10080);
alter table public.tasks add column if not exists reminded_at timestamptz;
alter table public.tasks add column if not exists series_id uuid references public.task_series (id) on delete set null;

-- Two devices extending a series at once can never create the same occurrence twice.
alter table public.tasks drop constraint if exists tasks_series_date_key;
alter table public.tasks add constraint tasks_series_date_key unique (series_id, scheduled_date);

drop trigger if exists labels_touch_updated_at on public.labels;
create trigger labels_touch_updated_at
  before update on public.labels
  for each row execute function public.tasks_touch_updated_at();

drop trigger if exists task_series_touch_updated_at on public.task_series;
create trigger task_series_touch_updated_at
  before update on public.task_series
  for each row execute function public.tasks_touch_updated_at();

alter table public.labels enable row level security;
alter table public.task_series enable row level security;

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

revoke all on public.labels, public.task_series from anon;
grant select, insert, update, delete on public.labels, public.task_series to authenticated;

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
