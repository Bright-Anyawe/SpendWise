import { describe, expect, it } from "vitest";
import type { BudgetStatus } from "@/lib/types/database";
import { paceNote, sortBudgets } from "./budgets";

function budget(overrides: Partial<BudgetStatus>): BudgetStatus {
  return {
    budget_id: "b",
    period: "monthly",
    category_id: null,
    category_name: null,
    amount: 3000,
    spent: 2184.3,
    remaining: 815.7,
    used_percent: 72.8,
    alert_at_percent: 80,
    state: "ok",
    period_start: "2026-11-01",
    period_end: "2026-11-30",
    ...overrides,
  };
}

describe("sortBudgets", () => {
  it("lists overall budgets monthly → weekly → daily, then categories most urgent first", () => {
    const { overall, categories } = sortBudgets([
      budget({ budget_id: "daily", period: "daily" }),
      budget({ budget_id: "fun", category_id: "f", category_name: "Fun", used_percent: 74 }),
      budget({ budget_id: "monthly" }),
      budget({ budget_id: "food", category_id: "g", category_name: "Food", used_percent: 92.8, state: "warning" }),
      budget({ budget_id: "weekly", period: "weekly" }),
      budget({ budget_id: "transport", category_id: "t", category_name: "Transport", used_percent: 104.5, state: "over" }),
    ]);
    expect(overall.map((b) => b.budget_id)).toEqual(["monthly", "weekly", "daily"]);
    expect(categories.map((b) => b.budget_id)).toEqual(["transport", "food", "fun"]);
  });
});

describe("paceNote", () => {
  it("says when spending is ahead of the month", () => {
    expect(paceNote(budget({}), "2026-11-19")).toBe(
      "You’ve used 73% of your monthly budget and 63% of November has gone, so you’re a little ahead of pace.",
    );
  });

  it("says when spending is comfortably within budget or on pace", () => {
    expect(paceNote(budget({ used_percent: 40 }), "2026-11-19")).toContain("comfortably within budget");
    expect(paceNote(budget({ used_percent: 62 }), "2026-11-19")).toContain("right on pace");
  });

  it("stays quiet when already over (the status says so)", () => {
    expect(paceNote(budget({ used_percent: 105, state: "over" }), "2026-11-19")).toBeNull();
  });
});
