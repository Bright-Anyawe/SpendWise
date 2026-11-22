-- Row Level Security and privileges.
-- The app runs every signed-in request as spendwise_user (see src/lib/db/user-transaction.ts).
-- That role gets exactly what the app needs, column by column where it matters, and RLS limits it
-- to the person in app.user_id. The owner role (used for migrations and the server's own jobs,
-- such as reminders) owns the tables and is not subject to RLS.

-- ─── Schema and table privileges ────────────────────────────────────────────

grant usage on schema public to spendwise_user;
grant usage on schema app to spendwise_user;

revoke all on
  public.profiles,
  public.categories,
  public.expenses,
  public.budgets,
  public.no_spend_days,
  public.notification_preferences,
  public.push_subscriptions,
  public.notifications
from public;

grant select on
  public.profiles,
  public.categories,
  public.expenses,
  public.budgets,
  public.no_spend_days,
  public.notification_preferences,
  public.push_subscriptions,
  public.notifications
to spendwise_user;

-- Profiles are created by app.ensure_profile() and removed by app.delete_my_account().
grant update (display_name, currency, timezone, week_starts_on, onboarded_at) on public.profiles to spendwise_user;

-- is_fallback is set only by app.ensure_profile().
grant insert (name, icon, color, sort_order, counts_as_spending) on public.categories to spendwise_user;
grant update (name, icon, color, sort_order, counts_as_spending) on public.categories to spendwise_user;
grant delete on public.categories to spendwise_user;

-- id may be supplied by the client so offline retries are idempotent. spent_at is derived by trigger.
grant insert (id, amount, category_id, payment_method, note, spent_on, spent_time) on public.expenses to spendwise_user;
grant update (amount, category_id, payment_method, note, spent_on, spent_time) on public.expenses to spendwise_user;
grant delete on public.expenses to spendwise_user;

-- Changing a budget's period or category means deleting it and creating another.
grant insert (period, category_id, amount, alert_at_percent) on public.budgets to spendwise_user;
grant update (amount, alert_at_percent) on public.budgets to spendwise_user;
grant delete on public.budgets to spendwise_user;

grant insert (day) on public.no_spend_days to spendwise_user;
grant delete on public.no_spend_days to spendwise_user;

grant update (
  daily_reminder_enabled, reminder_time, evening_review_enabled,
  weekly_summary_enabled, monthly_summary_enabled, budget_alerts_enabled
) on public.notification_preferences to spendwise_user;

grant insert (endpoint, p256dh, auth, user_agent) on public.push_subscriptions to spendwise_user;
grant delete on public.push_subscriptions to spendwise_user;

-- Notifications are written by the server; people can only mark them read.
grant update (read_at) on public.notifications to spendwise_user;

-- ─── Function privileges ────────────────────────────────────────────────────

revoke execute on function app.current_user_id() from public;
grant execute on function app.current_user_id() to spendwise_user;

revoke execute on function app.ensure_profile(text) from public;
grant execute on function app.ensure_profile(text) to spendwise_user;
revoke execute on function app.delete_my_account() from public;
grant execute on function app.delete_my_account() to spendwise_user;

revoke execute on function public.expenses_set_spent_at() from public;
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.protect_fallback_category() from public;
-- Used by the profiles CHECK constraint, which runs with the caller's privileges.
revoke execute on function public.is_valid_timezone(text) from public;
grant execute on function public.is_valid_timezone(text) to spendwise_user;

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;
alter table public.no_spend_days enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;

-- (select app.current_user_id()) is evaluated once per statement instead of once per row.

create policy "Read own profile" on public.profiles
  for select to spendwise_user using ((select app.current_user_id()) = id);
create policy "Update own profile" on public.profiles
  for update to spendwise_user using ((select app.current_user_id()) = id) with check ((select app.current_user_id()) = id);

create policy "Read own categories" on public.categories
  for select to spendwise_user using ((select app.current_user_id()) = user_id);
create policy "Create own categories" on public.categories
  for insert to spendwise_user with check ((select app.current_user_id()) = user_id);
create policy "Update own categories" on public.categories
  for update to spendwise_user using ((select app.current_user_id()) = user_id) with check ((select app.current_user_id()) = user_id);
create policy "Delete own categories" on public.categories
  for delete to spendwise_user using ((select app.current_user_id()) = user_id);

create policy "Read own expenses" on public.expenses
  for select to spendwise_user using ((select app.current_user_id()) = user_id);
create policy "Create own expenses" on public.expenses
  for insert to spendwise_user with check ((select app.current_user_id()) = user_id);
create policy "Update own expenses" on public.expenses
  for update to spendwise_user using ((select app.current_user_id()) = user_id) with check ((select app.current_user_id()) = user_id);
create policy "Delete own expenses" on public.expenses
  for delete to spendwise_user using ((select app.current_user_id()) = user_id);

create policy "Read own budgets" on public.budgets
  for select to spendwise_user using ((select app.current_user_id()) = user_id);
create policy "Create own budgets" on public.budgets
  for insert to spendwise_user with check ((select app.current_user_id()) = user_id);
create policy "Update own budgets" on public.budgets
  for update to spendwise_user using ((select app.current_user_id()) = user_id) with check ((select app.current_user_id()) = user_id);
create policy "Delete own budgets" on public.budgets
  for delete to spendwise_user using ((select app.current_user_id()) = user_id);

create policy "Read own no-spend days" on public.no_spend_days
  for select to spendwise_user using ((select app.current_user_id()) = user_id);
create policy "Create own no-spend days" on public.no_spend_days
  for insert to spendwise_user with check ((select app.current_user_id()) = user_id);
create policy "Delete own no-spend days" on public.no_spend_days
  for delete to spendwise_user using ((select app.current_user_id()) = user_id);

create policy "Read own notification preferences" on public.notification_preferences
  for select to spendwise_user using ((select app.current_user_id()) = user_id);
create policy "Update own notification preferences" on public.notification_preferences
  for update to spendwise_user using ((select app.current_user_id()) = user_id) with check ((select app.current_user_id()) = user_id);

create policy "Read own push subscriptions" on public.push_subscriptions
  for select to spendwise_user using ((select app.current_user_id()) = user_id);
create policy "Create own push subscriptions" on public.push_subscriptions
  for insert to spendwise_user with check ((select app.current_user_id()) = user_id);
create policy "Delete own push subscriptions" on public.push_subscriptions
  for delete to spendwise_user using ((select app.current_user_id()) = user_id);

create policy "Read own notifications" on public.notifications
  for select to spendwise_user using ((select app.current_user_id()) = user_id);
create policy "Mark own notifications read" on public.notifications
  for update to spendwise_user using ((select app.current_user_id()) = user_id) with check ((select app.current_user_id()) = user_id);
