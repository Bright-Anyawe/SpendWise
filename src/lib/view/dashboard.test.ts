import { describe, expect, it } from "vitest";
import type { BudgetStatus, DailyTotal, MonthlyTotal } from "@/lib/types/database";
import { budgetLeft, budgetsToWatch, comparisonLabel, highestDay, monthBars, rangeLabel, weekBars } from "./dashboard";

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
    default_amount: 3000,
    ...overrides,
  };
}

describe("comparisonLabel", () => {
  it("says less, more or about the same", () => {
    expect(comparisonLabel(86.5, 112, "yesterday")).toEqual({ text: "23% less than yesterday", tone: "less" });
    expect(comparisonLabel(2184.3, 2036, "1–19 October")).toEqual({ text: "7% more than 1–19 October", tone: "more" });
    expect(comparisonLabel(100.2, 100, "yesterday")).toEqual({ text: "About the same as yesterday", tone: "same" });
  });

  it("has nothing to compare when the earlier period is empty", () => {
    expect(comparisonLabel(50, 0, "yesterday")).toEqual({ text: "Nothing to compare with yesterday yet", tone: "none" });
    expect(comparisonLabel(0, 0, "yesterday").tone).toBe("none");
  });
});

describe("rangeLabel", () => {
  it("writes a date range compactly", () => {
    expect(rangeLabel("2026-10-01", "2026-10-19")).toBe("1–19 October");
    expect(rangeLabel("2026-11-09", "2026-11-09")).toBe("9 November");
    expect(rangeLabel("2026-10-28", "2026-11-03")).toBe("28 October – 3 November");
  });
});

describe("budgetLeft", () => {
  it("uses the overall monthly budget and splits what's left over the remaining days", () => {
    const left = budgetLeft([budget({})], "2026-11-19");
    expect(left).toMatchObject({ amount: 3000, spent: 2184.3, left: 815.7, daysLeft: 12 });
    expect(left?.perDay).toBeCloseTo(67.975, 3);
  });

  it("is null without a monthly budget and has no allowance when over", () => {
    expect(budgetLeft([budget({ period: "weekly" })], "2026-11-19")).toBeNull();
    expect(budgetLeft([], "2026-11-19")).toBeNull();
    expect(budgetLeft([budget({ spent: 3100, remaining: -100, used_percent: 103.3, state: "over" })], "2026-11-19")?.perDay).toBeNull();
  });
});

describe("weekBars", () => {
  const days: DailyTotal[] = [
    { day: "2026-11-16", total: 148, expense_count: 2 },
    { day: "2026-11-17", total: 64.2, expense_count: 3 },
    { day: "2026-11-18", total: 112, expense_count: 2 },
    { day: "2026-11-19", total: 86.5, expense_count: 4 },
    { day: "2026-11-20", total: 0, expense_count: 0 },
    { day: "2026-11-21", total: 0, expense_count: 0 },
    { day: "2026-11-22", total: 0, expense_count: 0 },
  ];

  it("labels weekdays, marks today and future days", () => {
    const bars = weekBars(days, "2026-11-19");
    expect(bars.map((b) => b.label)).toEqual(["Mon", "Tue", "Wed", "Today", "Fri", "Sat", "Sun"]);
    expect(bars.map((b) => b.kind)).toEqual(["past", "past", "past", "today", "future", "future", "future"]);
  });

  it("finds the highest day so far", () => {
    expect(highestDay(days, "2026-11-19")).toEqual({ day: "2026-11-16", total: 148 });
    expect(highestDay(days.map((d) => ({ ...d, total: 0 })), "2026-11-19")).toBeNull();
  });
});

describe("monthBars", () => {
  it("names months and marks the current one as partial", () => {
    const months: MonthlyTotal[] = [
      { month_start: "2026-10-01", total: 3310 },
      { month_start: "2026-11-01", total: 2184.3 },
    ];
    expect(monthBars(months, "2026-11-19")).toEqual([
      { key: "2026-10-01", label: "Oct", value: 3310, kind: "past" },
      { key: "2026-11-01", label: "Nov", value: 2184.3, kind: "partial" },
    ]);
  });
});

describe("budgetsToWatch", () => {
  it("puts over-budget first, then the most used, and leaves out the overall monthly budget", () => {
    const rows = [
      budget({ budget_id: "overall" }),
      budget({ budget_id: "shop", category_id: "s", category_name: "Shopping", used_percent: 88.6, state: "warning" }),
      budget({ budget_id: "fun", category_id: "f", category_name: "Fun", used_percent: 74, state: "ok" }),
      budget({ budget_id: "transport", category_id: "t", category_name: "Transportation", used_percent: 104.5, state: "over" }),
      budget({ budget_id: "food", category_id: "g", category_name: "Food", used_percent: 92.8, state: "warning" }),
    ];
    expect(budgetsToWatch(rows).map((b) => b.budget_id)).toEqual(["transport", "food", "shop"]);
  });
});
