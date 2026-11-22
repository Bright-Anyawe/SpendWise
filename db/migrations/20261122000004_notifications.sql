-- Which scheduled notifications are due right now, for everyone. Run by the reminder job as the
-- database owner (it is not granted to spendwise_user). Times are each person's own local time:
--   evening (reminder or review): from reminder_time until 2 hours after it; a no-spend mark silences it.
--     Nothing logged that day → daily_reminder (only for people with a device to push to);
--     something logged → evening_review. Both share the key evening:<day>, so only one is ever sent.
--   weekly_summary: on the first day of their week, 09:00–12:00, for the week before.
--   monthly_summary: on the 1st, 09:00–12:00, for the month before.
-- Rows whose dedupe key already exists are left out, so a late or repeated run sends nothing twice.

create or replace function app.due_notifications(p_now timestamptz default now())
returns table (
  user_id uuid,
  kind public.notification_kind,
  -- evening: that day; weekly: the first day of last week; monthly: the 1st of last month
  ref_date date,
  dedupe_key text,
  timezone text,
  currency text,
  local_date date,
  -- notifications already created on their local day (the job stops at 3)
  sent_today int
)
language sql
stable
set search_path = ''
as $$
  with people as (
    select
      p.id,
      p.timezone,
      p.currency,
      p.week_starts_on,
      (p_now at time zone p.timezone) as local_now,
      np.daily_reminder_enabled,
      np.reminder_time,
      np.evening_review_enabled,
      np.weekly_summary_enabled,
      np.monthly_summary_enabled,
      exists (select 1 from public.push_subscriptions s where s.user_id = p.id) as has_device
    from public.profiles p
    join public.notification_preferences np on np.user_id = p.id
    where p.onboarded_at is not null
  ),
  evening as (
    -- The window can run past midnight (a 23:00 reminder ends at 01:00), so check today and yesterday.
    select
      pe.*,
      d.day,
      exists (select 1 from public.expenses e where e.user_id = pe.id and e.spent_on = d.day) as logged
    from people pe
    cross join lateral (values (pe.local_now::date), (pe.local_now::date - 1)) d (day)
    where pe.local_now >= d.day + pe.reminder_time
      and pe.local_now < d.day + pe.reminder_time + interval '2 hours'
      and not exists (select 1 from public.no_spend_days n where n.user_id = pe.id and n.day = d.day)
  ),
  due as (
    select ev.id, 'evening_review'::public.notification_kind as kind, ev.day as ref_date, 'evening:' || ev.day as dedupe_key
    from evening ev
    where ev.logged and ev.evening_review_enabled
    union all
    select ev.id, 'daily_reminder', ev.day, 'evening:' || ev.day
    from evening ev
    where not ev.logged and ev.daily_reminder_enabled and ev.has_device
    union all
    select pe.id, 'weekly_summary', pe.local_now::date - 7, 'weekly:' || (pe.local_now::date - 7)
    from people pe
    where pe.weekly_summary_enabled
      and extract(dow from pe.local_now)::int = pe.week_starts_on
      and pe.local_now::time >= time '09:00' and pe.local_now::time < time '12:00'
    union all
    select pe.id, 'monthly_summary', (date_trunc('month', pe.local_now) - interval '1 month')::date,
           'monthly:' || to_char(date_trunc('month', pe.local_now) - interval '1 month', 'YYYY-MM')
    from people pe
    where pe.monthly_summary_enabled
      and extract(day from pe.local_now)::int = 1
      and pe.local_now::time >= time '09:00' and pe.local_now::time < time '12:00'
  )
  select
    d.id,
    d.kind,
    d.ref_date,
    d.dedupe_key,
    pe.timezone,
    pe.currency,
    pe.local_now::date,
    (
      select count(*)::int from public.notifications n
      where n.user_id = d.id and (n.created_at at time zone pe.timezone)::date = pe.local_now::date
    )
  from due d
  join people pe on pe.id = d.id
  where not exists (select 1 from public.notifications n where n.user_id = d.id and n.dedupe_key = d.dedupe_key)
  order by d.id, d.kind;
$$;

revoke execute on function app.due_notifications(timestamptz) from public;
