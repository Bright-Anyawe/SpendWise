import { describe, expect, it } from "vitest";
import { categoryInputSchema } from "./category";

describe("categoryInputSchema", () => {
  it("trims names and defaults to counting as spending", () => {
    expect(categoryInputSchema.parse({ name: "  Snacks " })).toEqual({ name: "Snacks", icon: "circle", countsAsSpending: true });
  });

  it("rejects empty and over-long names and bad icon keys", () => {
    expect(categoryInputSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(categoryInputSchema.safeParse({ name: "x".repeat(41) }).success).toBe(false);
    expect(categoryInputSchema.safeParse({ name: "Snacks", icon: "<script>" }).success).toBe(false);
  });
});
