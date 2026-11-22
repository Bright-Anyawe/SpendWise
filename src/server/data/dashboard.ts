import { addDays } from "@/lib/dates";
import { one, type Queryable } from "@/lib/db/queryable";
import type {
  BudgetStatus,
  CategoryTotal,
  Comparison,
  DailyTotal,
  ExpenseWithCategory,
  MonthlyTotal,
} from "@/lib/types/database";
import { budgetStatus } from "./budgets";
import { expensesOn } from "./expenses";

export interface DashboardData {
  /** The person's local date the numbers are for. */
  today: string;
  comparisons: Record<Comparison["kind"], Comparison>;
  week: { start: string; end: string; days: DailyTotal[] };
  month: { start: string; end: string; categories: CategoryTotal[] };
  lastSixMonths: MonthlyTotal[];
  budgets: BudgetStatus[];
  todaysExpenses: ExpenseWithCategory[];
  /** The person said "No spending today". */
  noSpendToday: boolean;
}

/** Everything the dashboard shows, computed in the database in the person's own time zone. */
export async function dashboardData(db: Queryable, ref?: string): Promise<DashboardData> {
  const { rows: comparisonRows } = await db.query<Comparison>("select * from public.spending_comparisons($1::date)", [
    ref ?? null,
  ]);
  const comparisons = Object.fromEntries(comparisonRows.map((c) => [c.kind, c])) as DashboardData["comparisons"];

  const today = comparisons.day.current_end;
  const weekStart = comparisons.week.current_start;
  const weekEnd = addDays(weekStart, 6);
  const month = await one<{ start_date: string; end_date: string }>(
    db,
    "select * from public.period_bounds('month', $1::date)",
    [today],
  );
  if (!month) throw new Error("Couldn't work out this month's dates.");

  const days = await db.query<DailyTotal>("select * from public.daily_totals($1::date, $2::date)", [weekStart, weekEnd]);
  const categories = await db.query<CategoryTotal>("select * from public.spending_by_category($1::date, $2::date)", [
    month.start_date,
    month.end_date,
  ]);
  const months = await db.query<MonthlyTotal>("select * from public.monthly_totals(6, $1::date)", [today]);
  const noSpend = await db.query("select 1 from public.no_spend_days where day = $1::date", [today]);

  return {
    today,
    comparisons,
    week: { start: weekStart, end: weekEnd, days: days.rows },
    month: { start: month.start_date, end: month.end_date, categories: categories.rows },
    lastSixMonths: months.rows,
    budgets: await budgetStatus(db, today),
    todaysExpenses: await expensesOn(db, today),
    noSpendToday: noSpend.rows.length > 0,
  };
}
