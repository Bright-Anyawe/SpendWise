import { describe, expect, it } from "vitest";
import { budgetInputSchema } from "./budget";

describe("budgetInputSchema", () => {
  it("accepts an overall monthly budget with the default alert point", () => {
    expect(budgetInputSchema.parse({ period: "monthly", amount: "3,000" })).toEqual({
      period: "monthly",
      categoryId: null,
      amount: "3000.00",
      alertAtPercent: 80,
    });
  });

  it("rejects an alert point outside 1–100 and an unknown period", () => {
    expect(budgetInputSchema.safeParse({ period: "monthly", amount: "100", alertAtPercent: 0 }).success).toBe(false);
    expect(budgetInputSchema.safeParse({ period: "monthly", amount: "100", alertAtPercent: 101 }).success).toBe(false);
    expect(budgetInputSchema.safeParse({ period: "yearly", amount: "100" }).success).toBe(false);
  });
});
