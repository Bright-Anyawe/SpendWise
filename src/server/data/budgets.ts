import { one, type Queryable } from "@/lib/db/queryable";
import type { Budget, BudgetStatus } from "@/lib/types/database";
import type { BudgetInput } from "@/schemas/budget";

/** Every budget with spent / remaining / state for the period containing `ref` (default: today). */
export async function budgetStatus(db: Queryable, ref?: string): Promise<BudgetStatus[]> {
  const { rows } = await db.query<BudgetStatus>("select * from public.budget_status($1::date)", [ref ?? null]);
  return rows;
}

export async function createBudget(db: Queryable, input: BudgetInput): Promise<Budget> {
  const row = await one<Budget>(
    db,
    "insert into public.budgets (period, category_id, amount, alert_at_percent) values ($1, $2, $3, $4) returning *",
    [input.period, input.categoryId, input.amount, input.alertAtPercent],
  );
  if (!row) throw new Error("The budget wasn't saved.");
  return row;
}

/** A budget's period and category never change; only its amount and alert point. */
export function updateBudget(
  db: Queryable,
  id: string,
  input: Pick<BudgetInput, "amount" | "alertAtPercent">,
): Promise<Budget | null> {
  return one<Budget>(db, "update public.budgets set amount = $2, alert_at_percent = $3 where id = $1 returning *", [
    id,
    input.amount,
    input.alertAtPercent,
  ]);
}

export interface BudgetAmount {
  budget_id: string;
  period_start: string;
  amount: number;
}

// The period (month, week or day) of budget $1 that contains date $2 (null: today), computed by the database.
const PERIOD_OF = `
  with target as (
    select b.id, pb.start_date
      from public.budgets b
      cross join lateral public.period_bounds(
        case b.period when 'daily' then 'day' when 'weekly' then 'week' else 'month' end,
        coalesce($2::date, public.local_today())
      ) pb
     where b.id = $1
  )`;

/**
 * Sets the amount for one period of a budget (the month, week or day containing `day`), e.g. a past
 * month someone forgot to set. Other periods are unchanged. Null when the budget isn't the person's.
 */
export function setBudgetAmount(db: Queryable, id: string, day: string | null, amount: string): Promise<BudgetAmount | null> {
  return one<BudgetAmount>(
    db,
    `${PERIOD_OF}
     insert into public.budget_amounts (budget_id, period_start, amount)
     select t.id, t.start_date, $3::numeric from target t
     on conflict (budget_id, period_start) do update set amount = excluded.amount
     returning budget_id, period_start, amount`,
    [id, day, amount],
  );
}

/**
 * For income that arrives in parts: raises the budget for the period containing `day` by `amount`,
 * starting from that period's current amount. Added in the database, so two quick additions can't
 * overwrite each other. Null when the budget isn't the person's or doesn't exist.
 */
export function addToBudget(db: Queryable, id: string, amount: string, day: string | null): Promise<BudgetAmount | null> {
  return one<BudgetAmount>(
    db,
    `${PERIOD_OF}
     insert into public.budget_amounts (budget_id, period_start, amount)
     select t.id, t.start_date, b.amount + $3::numeric
       from target t join public.budgets b on b.id = t.id
     on conflict (budget_id, period_start) do update set amount = public.budget_amounts.amount + $3::numeric
     returning budget_id, period_start, amount`,
    [id, day, amount],
  );
}

/** The alert point applies to every period of the budget. */
export function setBudgetAlert(db: Queryable, id: string, alertAtPercent: number): Promise<Budget | null> {
  return one<Budget>(db, "update public.budgets set alert_at_percent = $2 where id = $1 returning *", [id, alertAtPercent]);
}

export async function deleteBudget(db: Queryable, id: string): Promise<boolean> {
  const { rows } = await db.query("delete from public.budgets where id = $1 returning id", [id]);
  return rows.length > 0;
}
