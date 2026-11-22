import { describe, expect, it } from "vitest";
import { CURRENCIES, isSupportedCurrency } from "./currencies";

describe("currencies", () => {
  it("supports the cedi and rejects unknown codes", () => {
    expect(isSupportedCurrency("GHS")).toBe(true);
    expect(isSupportedCurrency("XYZ")).toBe(false);
    expect(isSupportedCurrency("ghs")).toBe(false);
  });

  it("uses ISO 4217 style codes", () => {
    for (const c of CURRENCIES) expect(c.code).toMatch(/^[A-Z]{3}$/);
  });

  it("shows the code for GHS and symbols for the others", () => {
    expect(CURRENCIES.find((c) => c.code === "GHS")?.display).toBe("code");
    expect(CURRENCIES.find((c) => c.code === "USD")?.display).toBe("symbol");
  });
});
