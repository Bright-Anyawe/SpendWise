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

export async function deleteBudget(db: Queryable, id: string): Promise<boolean> {
  const { rows } = await db.query("delete from public.budgets where id = $1 returning id", [id]);
  return rows.length > 0;
}
