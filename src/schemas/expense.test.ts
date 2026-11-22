import { describe, expect, it } from "vitest";
import { expenseFiltersSchema, expenseInputSchema, toExpenseRow } from "./expense";

const CATEGORY = "7d9f7b2e-3c1a-4e8b-9f2d-1a2b3c4d5e6f";
const valid = { amount: "35", categoryId: CATEGORY, paymentMethod: "cash", spentOn: "2026-11-19", spentTime: "12:30" };

describe("expenseInputSchema", () => {
  it("accepts a quick-add expense", () => {
    expect(expenseInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an unknown payment method, an impossible date and an impossible time", () => {
    expect(expenseInputSchema.safeParse({ ...valid, paymentMethod: "crypto" }).success).toBe(false);
    expect(expenseInputSchema.safeParse({ ...valid, spentOn: "2026-02-30" }).success).toBe(false);
    expect(expenseInputSchema.safeParse({ ...valid, spentOn: "19/11/2026" }).success).toBe(false);
    expect(expenseInputSchema.safeParse({ ...valid, spentTime: "25:00" }).success).toBe(false);
  });

  it("rejects bad amounts with a plain-words message", () => {
    const result = expenseInputSchema.safeParse({ ...valid, amount: "0" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Enter an amount above 0");
  });

  it("rejects notes over 280 characters", () => {
    expect(expenseInputSchema.safeParse({ ...valid, note: "x".repeat(281) }).success).toBe(false);
  });
});

describe("toExpenseRow", () => {
  it("normalises the amount and turns a blank note into null", () => {
    const row = toExpenseRow(expenseInputSchema.parse({ ...valid, amount: "1,234.5", note: "   " }));
    expect(row).toEqual({
      amount: "1234.50",
      category_id: CATEGORY,
      payment_method: "cash",
      note: null,
      spent_on: "2026-11-19",
      spent_time: "12:30",
    });
  });

  it("keeps a client-generated id for offline retries", () => {
    const id = "0b6c1e4a-5d2f-4a8b-8c3d-2e1f0a9b8c7d";
    expect(toExpenseRow(expenseInputSchema.parse({ ...valid, id })).id).toBe(id);
  });
});

describe("expenseFiltersSchema", () => {
  it("defaults to the first page and drops empty filters", () => {
    expect(expenseFiltersSchema.parse({ q: "  ", categoryIds: [] })).toEqual({ page: 0 });
  });

  it("rejects a range that ends before it starts", () => {
    expect(expenseFiltersSchema.safeParse({ from: "2026-11-30", to: "2026-11-01" }).success).toBe(false);
  });
});
