-- SpendWise Auto schema for Neon Postgres: tables, constraints, indexes and row-level triggers.
-- Row Level Security and privileges live in the next migration.
--
-- Who is signed in: Neon Auth (Managed Better Auth) keeps accounts in the neon_auth schema.
-- The app checks the session, then runs each request in a transaction as the restricted
-- role spendwise_user with app.user_id set to the person's id. app.current_user_id() reads it.

-- ─── App schema, role and identity ──────────────────────────────────────────

create schema if not exists app;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'spendwise_user') then
    create role spendwise_user nologin;
  end if;
end
$$;

-- The role that runs migrations (the database owner) is also the role the app connects as.
-- It switches into spendwise_user for each request, so it must be a member.
do $$
begin
  execute format('grant spendwise_user to %I', current_user);
end
$$;

-- The signed-in person for this transaction, or null.
create or replace function app.current_user_id()
returns uuid
language sql stable
set search_path = ''
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

-- ─── Types ──────────────────────────────────────────────────────────────────

create type public.payment_method as enum ('cash', 'mobile_money', 'card', 'bank_transfer', 'other');
create type public.budget_period as enum ('daily', 'weekly', 'monthly');
create type public.notification_kind as enum (
  'daily_reminder', 'evening_review', 'weekly_summary', 'monthly_summary', 'budget_warning', 'budget_exceeded'
);

-- ─── Helpers ────────────────────────────────────────────────────────────────

create or replace function public.is_valid_timezone(tz text)
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── Profiles (one per person; every other table hangs off this) ────────────

create table public.profiles (
  -- The Neon Auth user id (neon_auth."user".id). No foreign key into Neon's managed schema.
  id uuid primary key,
  display_name text check (display_name is null or char_length(display_name) between 1 and 60),
  currency text not null default 'GHS' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Africa/Accra' check (public.is_valid_timezone(timezone)),
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.week_starts_on is '0 = Sunday … 6 = Saturday';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─── Categories ─────────────────────────────────────────────────────────────

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default app.current_user_id() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  icon text not null default 'circle' check (icon ~ '^[a-z0-9-]{1,40}$'),
  color text not null default 'emerald' check (color ~ '^[a-z0-9-]{1,20}$'),
  sort_order integer not null default 0,
  counts_as_spending boolean not null default true,
  is_fallback boolean not null default false,
  created_at timestamptz not null default now(),
  -- Target of composite foreign keys so children can only point at their owner's categories.
  unique (id, user_id)
);

create unique index categories_user_name_key on public.categories (user_id, lower(btrim(name)));
create unique index categories_one_fallback_per_user on public.categories (user_id) where is_fallback;

-- "Other" can be renamed but never deleted, except when the whole account is being removed
-- (by then the profile row is already gone).
create or replace function public.protect_fallback_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_fallback and exists (select 1 from public.profiles p where p.id = old.user_id) then
    raise exception 'The fallback category can''t be deleted' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger categories_protect_fallback
  before delete on public.categories
  for each row execute function public.protect_fallback_category();

-- ─── Expenses ───────────────────────────────────────────────────────────────

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default app.current_user_id() references public.profiles (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  category_id uuid not null,
  payment_method public.payment_method not null default 'cash',
  note text check (note is null or char_length(note) <= 280),
  -- The calendar day and wall-clock time the person says it happened, in their time zone.
  -- All daily/weekly/monthly bucketing uses spent_on.
  spent_on date not null check (spent_on >= date '2000-01-01'),
  spent_time time not null default '12:00',
  -- The exact instant, derived by trigger from spent_on + spent_time in the profile time zone.
  spent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories (id, user_id)
);

create index expenses_user_spent_on_idx on public.expenses (user_id, spent_on desc, spent_at desc);
create index expenses_user_category_idx on public.expenses (user_id, category_id, spent_on);

create or replace function public.expenses_set_spent_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text;
begin
  select p.timezone into tz from public.profiles p where p.id = new.user_id;
  new.spent_at := (new.spent_on + new.spent_time) at time zone coalesce(tz, 'UTC');
  return new;
end;
$$;

create trigger expenses_set_spent_at
  before insert or update of spent_on, spent_time on public.expenses
  for each row execute function public.expenses_set_spent_at();

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ─── Budgets ────────────────────────────────────────────────────────────────

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default app.current_user_id() references public.profiles (id) on delete cascade,
  period public.budget_period not null,
  -- null = overall budget for the period
  category_id uuid,
  amount numeric(14, 2) not null check (amount > 0),
  alert_at_percent smallint not null default 80 check (alert_at_percent between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade,
  unique nulls not distinct (user_id, period, category_id)
);

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- ─── No-spend days ──────────────────────────────────────────────────────────

create table public.no_spend_days (
  user_id uuid not null default app.current_user_id() references public.profiles (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ─── Notifications ──────────────────────────────────────────────────────────

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  daily_reminder_enabled boolean not null default true,
  reminder_time time not null default '20:00'
    check (extract(minute from reminder_time)::int % 15 = 0 and extract(second from reminder_time) = 0),
  evening_review_enabled boolean not null default false,
  weekly_summary_enabled boolean not null default true,
  monthly_summary_enabled boolean not null default true,
  budget_alerts_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default app.current_user_id() references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  -- e.g. 'daily_reminder:2026-11-19' — a second insert with the same key fails, so nothing is sent twice.
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

-- ─── First sign-in and account removal ─────────────────────────────────────

-- Creates the signed-in person's profile, preferences and default categories the first time
-- they use the app. Safe to call on every sign-in: does nothing once the profile exists.
create or replace function app.ensure_profile(p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := app.current_user_id();
  v_created int;
begin
  if v_user is null then
    raise exception 'No one is signed in' using errcode = '42501';
  end if;

  insert into public.profiles (id, display_name)
  values (v_user, left(nullif(btrim(p_display_name), ''), 60))
  on conflict (id) do nothing;
  get diagnostics v_created = row_count;
  if v_created = 0 then
    return;
  end if;

  insert into public.notification_preferences (user_id) values (v_user);

  insert into public.categories (user_id, name, icon, sort_order, counts_as_spending, is_fallback)
  values
    (v_user, 'Food & Groceries',  'utensils',      1,  true,  false),
    (v_user, 'Transportation',    'bus',           2,  true,  false),
    (v_user, 'Rent & Housing',    'house',         3,  true,  false),
    (v_user, 'Utilities & Bills', 'zap',           4,  true,  false),
    (v_user, 'Shopping',          'shopping-bag',  5,  true,  false),
    (v_user, 'Healthcare',        'heart-pulse',   6,  true,  false),
    (v_user, 'Education',         'book-open',     7,  true,  false),
    (v_user, 'Entertainment',     'ticket',        8,  true,  false),
    (v_user, 'Family & Gifts',    'gift',          9,  true,  false),
    (v_user, 'Business',          'briefcase',     10, true,  false),
    (v_user, 'Savings',           'piggy-bank',    11, false, false),
    (v_user, 'Other',             'ellipsis',      12, true,  true);
end;
$$;

-- Removes everything the signed-in person stored in the app. The Neon Auth account itself is
-- deleted separately through Neon Auth.
create or replace function app.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := app.current_user_id();
begin
  if v_user is null then
    raise exception 'No one is signed in' using errcode = '42501';
  end if;
  delete from public.profiles where id = v_user;
end;
$$;
