-- ─── Run this entire file in Supabase → SQL Editor ──────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Profiles (one per user, created automatically on sign-up) ───────────────
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text,
  subscription_status text default 'trialing',  -- trialing | active | canceled | past_due
  stripe_customer_id  text,
  stripe_subscription_id text,
  trial_ends_at       timestamptz default (now() + interval '7 days'),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, subscription_status, trial_ends_at)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    'trialing',
    now() + interval '7 days'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Projects ─────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  deadline    date,
  weight      integer default 5 check (weight between 1 and 10),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── Tasks ────────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete cascade,
  title       text not null,
  description text,
  priority    text default 'medium' check (priority in ('critical','high','medium','low')),
  due_date    date,
  status      text default 'todo' check (status in ('todo','in-progress','done')),
  effort      numeric(5,1),       -- estimated hours
  actual      numeric(5,1),       -- actual hours logged
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── Row Level Security (users only see their own data) ───────────────────────
alter table public.profiles  enable row level security;
alter table public.projects  enable row level security;
alter table public.tasks     enable row level security;

-- Profiles: users can read/update their own
create policy "Users can view own profile"   on public.profiles  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles  for update using (auth.uid() = id);

-- Projects: full CRUD for own rows
create policy "Users can CRUD own projects"  on public.projects  for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tasks: full CRUD for own rows
create policy "Users can CRUD own tasks"     on public.tasks     for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Indexes for query performance ────────────────────────────────────────────
create index if not exists idx_projects_user   on public.projects(user_id);
create index if not exists idx_tasks_user      on public.tasks(user_id);
create index if not exists idx_tasks_project   on public.tasks(project_id);
create index if not exists idx_tasks_status    on public.tasks(status);

-- ─── Webhook helper: allow service role to update profiles ────────────────────
-- (The Stripe webhook Vercel function uses the service role key, bypassing RLS)
-- No extra policy needed — service role bypasses RLS by default.
