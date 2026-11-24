-- Budget amounts per period. Income often arrives in parts and varies month to month, so each month
-- (or week, or day) can have its own amount. A period without one uses the budget's usual amount
-- (public.budgets.amount). Setting a past month's amount never changes another month.

-- Target of the composite foreign key below, so an amount can only belong to its owner's budget.
alter table public.budgets add constraint budgets_id_user_id_key unique (id, user_id);

create table public.budget_amounts (
  budget_id uuid not null,
  user_id uuid not null default app.current_user_id() references public.profiles (id) on delete cascade,
  -- First day of the period (the 1st for monthly, the week's first day for weekly, the day for daily).
  period_start date not null,
  amount numeric(14, 2) not null check (amount > 0),
  updated_at timestamptz not null default now(),
  primary key (budget_id, period_start),
  foreign key (budget_id, user_id) references public.budgets (id, user_id) on delete cascade
);

create index budget_amounts_user_idx on public.budget_amounts (user_id);

create trigger budget_amounts_set_updated_at
  before update on public.budget_amounts
  for each row execute function public.set_updated_at();

revoke all on public.budget_amounts from public;
grant select, delete on public.budget_amounts to spendwise_user;
grant insert (budget_id, period_start, amount) on public.budget_amounts to spendwise_user;
grant update (amount) on public.budget_amounts to spendwise_user;

alter table public.budget_amounts enable row level security;

create policy "Read own budget amounts" on public.budget_amounts
  for select to spendwise_user using ((select app.current_user_id()) = user_id);
create policy "Create own budget amounts" on public.budget_amounts
  for insert to spendwise_user with check ((select app.current_user_id()) = user_id);
create policy "Update own budget amounts" on public.budget_amounts
  for update to spendwise_user using ((select app.current_user_id()) = user_id) with check ((select app.current_user_id()) = user_id);
create policy "Delete own budget amounts" on public.budget_amounts
  for delete to spendwise_user using ((select app.current_user_id()) = user_id);

-- budget_status now uses the period's own amount when there is one, and also returns the usual
-- amount (default_amount). The return type changes, so the function is dropped and recreated.
drop function public.budget_status(date);

create function public.budget_status(p_ref date default null)
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
  period_end date,
  default_amount numeric
)
language sql stable
set search_path = ''
as $$
  with ref as (
    select coalesce(p_ref, public.local_today()) as d
  ),
  b as (
    select
      bu.id, bu.user_id, bu.period, bu.category_id, bu.alert_at_percent, pb.start_date, pb.end_date,
      coalesce(ba.amount, bu.amount) as amount,
      bu.amount as default_amount
    from public.budgets bu
    cross join ref
    cross join lateral public.period_bounds(
      case bu.period when 'daily' then 'day' when 'weekly' then 'week' else 'month' end,
      ref.d
    ) pb
    left join public.budget_amounts ba
      on ba.budget_id = bu.id and ba.user_id = bu.user_id and ba.period_start = pb.start_date
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
    b.end_date,
    b.default_amount
  from b
  join s on s.id = b.id
  left join public.categories cat on cat.id = b.category_id and cat.user_id = b.user_id
  order by
    (b.category_id is not null),
    case b.period when 'monthly' then 1 when 'weekly' then 2 else 3 end,
    cat.name;
$$;

revoke execute on function public.budget_status(date) from public;
grant execute on function public.budget_status(date) to spendwise_user;
