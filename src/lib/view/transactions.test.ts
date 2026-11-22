import { describe, expect, it } from "vitest";
import type { ExpenseWithCategory } from "@/lib/types/database";
import { groupByDay, parseTransactionFilters } from "./transactions";

const TODAY = "2026-11-19"; // a Thursday
const CAT = "7d9f7b2e-3c1a-4e8b-9f2d-1a2b3c4d5e6f";

describe("parseTransactionFilters", () => {
  it("defaults to this month", () => {
    expect(parseTransactionFilters({}, TODAY, 1)).toEqual({
      period: "month",
      filters: { page: 0, from: "2026-11-01", to: "2026-11-30" },
    });
  });

  it("uses the person's week start for this week", () => {
    expect(parseTransactionFilters({ period: "week" }, TODAY, 1).filters).toMatchObject({ from: "2026-11-16", to: "2026-11-22" });
    expect(parseTransactionFilters({ period: "week" }, TODAY, 0).filters).toMatchObject({ from: "2026-11-15", to: "2026-11-21" });
  });

  it("reads every filter", () => {
    const parsed = parseTransactionFilters(
      { period: "custom", from: "2026-10-01", to: "2026-10-31", category: [CAT], method: "mobile_money", min: "20", max: "80.5", q: " lunch ", page: "2" },
      TODAY,
      1,
    );
    expect(parsed).toEqual({
      period: "custom",
      filters: {
        page: 2,
        from: "2026-10-01",
        to: "2026-10-31",
        categoryIds: [CAT],
        paymentMethods: ["mobile_money"],
        minAmount: 20,
        maxAmount: 80.5,
        q: "lunch",
      },
    });
  });

  it("drops values typed by hand that make no sense", () => {
    const parsed = parseTransactionFilters(
      { period: "decade", category: "not-a-uuid", method: ["crypto"], min: "abc", max: "-5", page: "-1", from: "2026-02-30" },
      TODAY,
      1,
    );
    expect(parsed).toEqual({ period: "month", filters: { page: 0, from: "2026-11-01", to: "2026-11-30" } });
  });

  it("shows everything for all time", () => {
    expect(parseTransactionFilters({ period: "all" }, TODAY, 1)).toEqual({ period: "all", filters: { page: 0 } });
  });
});

function expense(id: string, day: string, amount: number): ExpenseWithCategory {
  return {
    id,
    user_id: "u",
    amount,
    category_id: CAT,
    payment_method: "cash",
    note: null,
    spent_on: day,
    spent_time: "12:00:00",
    spent_at: `${day}T12:00:00.000Z`,
    created_at: "",
    updated_at: "",
    category: { name: "Food", icon: "utensils" },
  };
}

describe("groupByDay", () => {
  it("groups newest-first rows by day with labels and totals", () => {
    const groups = groupByDay(
      [expense("a", "2026-11-19", 23), expense("b", "2026-11-19", 8.5), expense("c", "2026-11-18", 74), expense("d", "2026-11-17", 0.1), expense("e", "2026-11-17", 0.2)],
      TODAY,
    );
    expect(groups.map((g) => [g.label, g.total, g.rows.length])).toEqual([
      ["Today", 31.5, 2],
      ["Yesterday", 74, 1],
      ["Tue 17 Nov", 0.3, 2],
    ]);
  });
});
