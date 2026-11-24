import { describe, expect, it } from "vitest";
import type { BudgetStatus, CategoryTotal, DailyTotal } from "@/lib/types/database";
import type { ReportData } from "@/server/data/reports";
import { buildInsights } from "./insights";

const money = (n: number) => `GHS ${n.toFixed(2)}`;

function cat(name: string, total: number, share: number | null, counts = true, count = 3): CategoryTotal {
  return { category_id: name, name, icon: "circle", counts_as_spending: counts, total, expense_count: count, share };
}

function report(overrides: Partial<ReportData> = {}): ReportData {
  return {
    period: "month",
    start: "2026-11-01",
    end: "2026-11-30",
    today: "2026-11-19",
    isCurrent: true,
    upTo: "2026-11-19",
    total: 2184.3,
    count: 47,
    previous: { start: "2026-10-01", end: "2026-10-19", total: 2036 },
    days: [] as DailyTotal[],
    categories: [cat("Food & Groceries", 742.5, 34), cat("Transportation", 418, 19.1), cat("Savings", 500, null, false)],
    previousCategories: [cat("Food & Groceries", 700, 34.4), cat("Transportation", 300, 14.7)],
    budgets: [] as BudgetStatus[],
    loggedDays: 7,
    ...overrides,
  };
}

const texts = (r: ReportData) => buildInsights(r, money).map((i) => i.text);

describe("buildInsights", () => {
  it("names the top category, the overall change and the biggest category change", () => {
    expect(texts(report())).toEqual([
      "Food & Groceries is your highest spending category this month: GHS 742.50, or 34% of your spending.",
      "You spent 7% more than in the same days last month.",
      "You spent 39% more on Transportation than in the same days last month.",
      "You set aside GHS 500.00 to savings.",
      "You’ve logged expenses every day for the last 7 days.",
    ]);
  });

  it("needs at least 3 expenses before naming a top category", () => {
    const r = report({ count: 2, categories: [cat("Food & Groceries", 50, 100, true, 2)], previousCategories: [] });
    expect(texts(r).some((t) => t.includes("highest spending category"))).toBe(false);
  });

  it("ignores small category changes and tiny categories", () => {
    const r = report({
      categories: [cat("Food & Groceries", 742.5, 34), cat("Transportation", 330, 15), cat("Fun", 40, 1.8)],
      previousCategories: [cat("Food & Groceries", 700, 34.4), cat("Transportation", 300, 14.7), cat("Fun", 10, 0.5)],
    });
    expect(texts(r).some((t) => t.includes("on Transportation") || t.includes("on Fun"))).toBe(false);
  });

  it("talks about the budget only when there is one", () => {
    const withBudget = report({
      budgets: [
        {
          budget_id: "b", period: "monthly", category_id: null, category_name: null, amount: 3000, spent: 2184.3,
          remaining: 815.7, used_percent: 72.8, alert_at_percent: 80, state: "ok", period_start: "2026-11-01", period_end: "2026-11-30", default_amount: 3000,
        },
        {
          budget_id: "t", period: "monthly", category_id: "t", category_name: "Transportation", amount: 400, spent: 418,
          remaining: -18, used_percent: 104.5, alert_at_percent: 80, state: "over", period_start: "2026-11-01", period_end: "2026-11-30", default_amount: 400,
        },
      ],
    });
    const t = texts(withBudget);
    expect(t).toContain("You’ve used 73% of your monthly budget, with 12 days left.");
    expect(t).toContain("Transportation is GHS 18.00 over its monthly budget.");
    expect(texts(report()).some((x) => x.includes("budget"))).toBe(false);
  });

  it("compares a past month with the whole previous month", () => {
    const r = report({ isCurrent: false, upTo: "2026-10-31", start: "2026-10-01", end: "2026-10-31", previous: { start: "2026-09-01", end: "2026-09-30", total: 2000 }, total: 3310 });
    expect(texts(r)).toContain("You spent 66% more than in September.");
    expect(texts(r)[0]).toContain("in October");
  });

  it("says how a past month went against that month's own budget", () => {
    const october = { start: "2026-10-01", end: "2026-10-31", isCurrent: false, upTo: "2026-10-31" };
    const budget = (amount: number, spent: number): BudgetStatus => ({
      budget_id: "b", period: "monthly", category_id: null, category_name: null, amount, spent, remaining: amount - spent,
      used_percent: (spent / amount) * 100, alert_at_percent: 80, state: spent > amount ? "over" : "ok",
      period_start: "2026-10-01", period_end: "2026-10-31", default_amount: 1200,
    });
    expect(texts(report({ ...october, budgets: [budget(1500, 1350)] }))).toContain(
      "You stayed within your monthly budget of GHS 1500.00, with GHS 150.00 left.",
    );
    expect(texts(report({ ...october, budgets: [budget(1500, 1620)] }))).toContain("You went GHS 120.00 over your monthly budget of GHS 1500.00.");
  });

  it("empty data gives no insights", () => {
    expect(buildInsights(report({ total: 0, count: 0, categories: [], previousCategories: [], previous: { start: "x", end: "y", total: 0 }, loggedDays: 0 }), money)).toEqual([]);
  });
});
