-- Spending calculations and category management.
-- All functions run as the caller (security invoker), so RLS still applies, and
-- additionally filter on app.current_user_id() so a caller with no signed-in person sees nothing.
-- Only categories with counts_as_spending = true are "spending" (Savings is set aside, not spent).

-- ─── Dates ──────────────────────────────────────────────────────────────────

create or replace function public.local_today()
returns date
language sql stable
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select p.timezone from public.profiles p where p.id = (select app.current_user_id())),
    'UTC'
  ))::date;
$$;

-- p_kind: 'day' | 'week' | 'month'. Weeks start on the profile's week_starts_on (0 = Sunday).
create or replace function public.period_bounds(p_kind text, p_ref date default null)
returns table (start_date date, end_date date)
language plpgsql stable
set search_path = ''
as $$
declare
  v_ref date := coalesce(p_ref, public.local_today());
  v_week_start smallint;
  v_offset int;
begin
  if p_kind = 'day' then
    return query select v_ref, v_ref;
  elsif p_kind = 'week' then
    select coalesce(
      (select p.week_starts_on from public.profiles p where p.id = (select app.current_user_id())),
      1
    ) into v_week_start;
    v_offset := (extract(dow from v_ref)::int - v_week_start + 7) % 7;
    return query select v_ref - v_offset, v_ref - v_offset + 6;
  elsif p_kind = 'month' then
    return query select date_trunc('month', v_ref)::date, (date_trunc('month', v_ref) + interval '1 month - 1 day')::date;
  else
    raise exception 'Unknown period kind: %', p_kind using errcode = '22023';
  end if;
end;
$$;

-- ─── Totals ─────────────────────────────────────────────────────────────────

create or replace function public.spending_total(p_from date, p_to date)
returns table (total numeric, expense_count int)
language sql stable
set search_path = ''
as $$
  select coalesce(sum(e.amount), 0), count(*)::int
  from public.expenses e
  join public.categories c on c.id = e.category_id and c.user_id = e.user_id
  where e.user_id = (select app.current_user_id())
    and e.spent_on between p_from and p_to
    and c.counts_as_spending;
$$;

-- Every category with expenses in the range. share is % of spending (null for non-spending categories).
create or replace function public.spending_by_category(p_from date, p_to date)
returns table (
  category_id uuid,
  name text,
  icon text,
  counts_as_spending boolean,
  total numeric,
  expense_count int,
  share numeric
)
language sql stable
set search_path = ''
as $$
  with per_category as (
    select c.id, c.name, c.icon, c.counts_as_spending, sum(e.amount) as total, count(*)::int as n
    from public.expenses e
    join public.categories c on c.id = e.category_id and c.user_id = e.user_id
    where e.user_id = (select app.current_user_id())
      and e.spent_on between p_from and p_to
    group by c.id
  ),
  spending as (
    select coalesce(sum(pc.total), 0) as t from per_category pc where pc.counts_as_spending
  )
  select
    pc.id, pc.name, pc.icon, pc.counts_as_spending, pc.total, pc.n,
    case when pc.counts_as_spending and s.t > 0 then round(pc.total / s.t * 100, 1) end
  from per_category pc
  cross join spending s
  order by pc.counts_as_spending desc, pc.total desc, pc.name;
$$;

-- One row per day in the range (max 400 days), including days with no spending.
create or replace function public.daily_totals(p_from date, p_to date)
returns table (day date, total numeric, expense_count int)
language sql stable
set search_path = ''
as $$
  select
    d::date,
    coalesce(sum(e.amount) filter (where c.counts_as_spending), 0),
    (count(e.id) filter (where c.counts_as_spending))::int
  from generate_series(p_from, least(p_to, p_from + 400), interval '1 day') as d
  left join public.expenses e
    on e.user_id = (select app.current_user_id()) and e.spent_on = d::date
  left join public.categories c
    on c.id = e.category_id and c.user_id = e.user_id
  group by d
  order by d;
$$;

-- The last p_months calendar months (1–36) ending with p_ref's month, oldest first.
create or replace function public.monthly_totals(p_months int, p_ref date default null)
returns table (month_start date, total numeric)
language sql stable
set search_path = ''
as $$
  with anchor as (
    select date_trunc('month', coalesce(p_ref, public.local_today()))::date as last_month,
           greatest(1, least(coalesce(p_months, 6), 36)) as n
  ),
  months as (
    select (a.last_month - make_interval(months => g))::date as m
    from anchor a
    cross join lateral generate_series(0, a.n - 1) as g
  )
  select
    mo.m,
    coalesce(sum(e.amount) filter (where c.counts_as_spending), 0)
  from months mo
  left join public.expenses e
    on e.user_id = (select app.current_user_id())
   and e.spent_on >= mo.m
   and e.spent_on < (mo.m + interval '1 month')::date
  left join public.categories c
    on c.id = e.category_id and c.user_id = e.user_id
  group by mo.m
  order by mo.m;
$$;

-- Like-for-like comparisons for today, this week and this month up to p_ref:
--   day:   p_ref vs the day before
--   week:  week start..p_ref vs the same days of the previous week
--   month: month start..p_ref vs the same days of the previous month, capped at that month's end
create or replace function public.spending_comparisons(p_ref date default null)
returns table (
  kind text,
  current_start date,
  current_end date,
  current_total numeric,
  current_count int,
  previous_start date,
  previous_end date,
  previous_total numeric
)
language plpgsql stable
set search_path = ''
as $$
declare
  v_ref date := coalesce(p_ref, public.local_today());
  v_kind text;
  v_start date;
  v_prev_start date;
  v_prev_end date;
begin
  foreach v_kind in array array['day', 'week', 'month'] loop
    select b.start_date into v_start from public.period_bounds(v_kind, v_ref) b;

    if v_kind = 'day' then
      v_prev_start := v_ref - 1;
    elsif v_kind = 'week' then
      v_prev_start := v_start - 7;
    else
      v_prev_start := (v_start - interval '1 month')::date;
    end if;

    v_prev_end := v_prev_start + (v_ref - v_start);
    if v_kind = 'month' then
      v_prev_end := least(v_prev_end, v_start - 1);
    end if;

    kind := v_kind;
    current_start := v_start;
    current_end := v_ref;
    previous_start := v_prev_start;
    previous_end := v_prev_end;
    select t.total, t.expense_count into current_total, current_count
      from public.spending_total(v_start, v_ref) t;
    select t.total into previous_total
      from public.spending_total(v_prev_start, v_prev_end) t;
    return next;
  end loop;
end;
$$;

-- ─── Budgets ────────────────────────────────────────────────────────────────

-- Each budget for the period containing p_ref.
-- state: 'over' if spent > amount, 'warning' from alert_at_percent, else 'ok'.
-- Overall budgets count spending categories only; category budgets count that category.
create or replace function public.budget_status(p_ref date default null)
returns table (
  budget_id uuid,
  period public.budget_period,
  category_id uuid,
  category_name text,
  amount numeric,
  spent numeric,
  remaining numeric,
  used_percent numeric,
  alert_at_percent smallint,
  state text,
  period_start date,
  period_end date
)
language sql stable
set search_path = ''
as $$
  with ref as (
    select coalesce(p_ref, public.local_today()) as d
  ),
  b as (
    select bu.id, bu.user_id, bu.period, bu.category_id, bu.amount, bu.alert_at_percent, pb.start_date, pb.end_date
    from public.budgets bu
    cross join ref
    cross join lateral public.period_bounds(
      case bu.period when 'daily' then 'day' when 'weekly' then 'week' else 'month' end,
      ref.d
    ) pb
    where bu.user_id = (select app.current_user_id())
  ),
  s as (
    select
      b.id,
      coalesce(sum(e.amount) filter (where b.category_id is not null or c.counts_as_spending), 0) as spent
    from b
    left join public.expenses e
      on e.user_id = b.user_id
     and e.spent_on between b.start_date and b.end_date
     and (b.category_id is null or e.category_id = b.category_id)
    left join public.categories c
      on c.id = e.category_id and c.user_id = e.user_id
    group by b.id
  )
  select
    b.id,
    b.period,
    b.category_id,
    cat.name,
    b.amount,
    s.spent,
    b.amount - s.spent,
    round(s.spent / b.amount * 100, 1),
    b.alert_at_percent,
    case
      when s.spent > b.amount then 'over'
      when s.spent * 100 >= b.amount * b.alert_at_percent then 'warning'
      else 'ok'
    end,
    b.start_date,
    b.end_date
  from b
  join s on s.id = b.id
  left join public.categories cat on cat.id = b.category_id and cat.user_id = b.user_id
  order by
    (b.category_id is not null),
    case b.period when 'monthly' then 1 when 'weekly' then 2 else 3 end,
    cat.name;
$$;

-- ─── Categories ─────────────────────────────────────────────────────────────

-- Deletes a category after moving its expenses to another of the caller's categories.
-- Budgets for the deleted category are removed with it. The fallback category can't be deleted.
create or replace function public.delete_category(p_category_id uuid, p_move_to uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_is_fallback boolean;
begin
  if p_category_id = p_move_to then
    raise exception 'Choose a different category to move these expenses to' using errcode = '22023';
  end if;

  select c.is_fallback into v_is_fallback
  from public.categories c
  where c.id = p_category_id and c.user_id = (select app.current_user_id());
  if not found then
    raise exception 'Category not found' using errcode = 'P0002';
  end if;
  if v_is_fallback then
    raise exception 'The fallback category can''t be deleted' using errcode = '42501';
  end if;

  perform 1 from public.categories c where c.id = p_move_to and c.user_id = (select app.current_user_id());
  if not found then
    raise exception 'The category to move expenses to was not found' using errcode = 'P0002';
  end if;

  update public.expenses e
     set category_id = p_move_to
   where e.category_id = p_category_id and e.user_id = (select app.current_user_id());

  delete from public.categories c
   where c.id = p_category_id and c.user_id = (select app.current_user_id());
end;
$$;

-- ─── Privileges ─────────────────────────────────────────────────────────────

revoke execute on function public.local_today() from public;
revoke execute on function public.period_bounds(text, date) from public;
revoke execute on function public.spending_total(date, date) from public;
revoke execute on function public.spending_by_category(date, date) from public;
revoke execute on function public.daily_totals(date, date) from public;
revoke execute on function public.monthly_totals(int, date) from public;
revoke execute on function public.spending_comparisons(date) from public;
revoke execute on function public.budget_status(date) from public;
revoke execute on function public.delete_category(uuid, uuid) from public;

grant execute on function public.local_today() to spendwise_user;
grant execute on function public.period_bounds(text, date) to spendwise_user;
grant execute on function public.spending_total(date, date) to spendwise_user;
grant execute on function public.spending_by_category(date, date) to spendwise_user;
grant execute on function public.daily_totals(date, date) to spendwise_user;
grant execute on function public.monthly_totals(int, date) to spendwise_user;
grant execute on function public.spending_comparisons(date) to spendwise_user;
grant execute on function public.budget_status(date) to spendwise_user;
grant execute on function public.delete_category(uuid, uuid) to spendwise_user;
