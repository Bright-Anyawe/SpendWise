import { describe, expect, it } from "vitest";
import { onboardingSchema } from "./profile";

const valid = { currency: "GHS", timezone: "Africa/Accra", weekStartsOn: 1 };

describe("onboardingSchema", () => {
  it("accepts the defaults and an optional budget", () => {
    expect(onboardingSchema.parse({ ...valid, monthlyBudget: "3,000" })).toEqual({ ...valid, monthlyBudget: "3000.00" });
    expect(onboardingSchema.parse({ ...valid, monthlyBudget: "" })).toEqual({ ...valid, monthlyBudget: undefined });
  });

  it("rejects unknown currency, invalid time zone and week start 7", () => {
    expect(onboardingSchema.safeParse({ ...valid, currency: "XYZ" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...valid, timezone: "Mars/Olympus" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...valid, weekStartsOn: 7 }).success).toBe(false);
  });

  it("rejects a budget that isn't a positive amount", () => {
    expect(onboardingSchema.safeParse({ ...valid, monthlyBudget: "-5" }).success).toBe(false);
  });

  it("coerces form values", () => {
    expect(onboardingSchema.parse({ ...valid, weekStartsOn: "0" }).weekStartsOn).toBe(0);
  });
});
