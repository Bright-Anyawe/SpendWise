import { describe, expect, it } from "vitest";
import { formatMoney, parseAmount } from "./money";

describe("parseAmount", () => {
  it("normalises valid input to a 2-decimal string", () => {
    expect(parseAmount("1,234.5")).toBe("1234.50");
    expect(parseAmount(" 35 ")).toBe("35.00");
    expect(parseAmount("0.5")).toBe("0.50");
    expect(parseAmount(".75")).toBe("0.75");
    expect(parseAmount("999999999.99")).toBe("999999999.99");
  });

  it("rejects zero, negatives, too many decimals and junk", () => {
    for (const bad of ["0", "0.00", "-5", "12.345", "abc", "1e3", "", "  ", "1.2.3", "1,23,4.5x", "1000000000"]) {
      expect(parseAmount(bad), bad).toBeNull();
    }
  });
});

describe("formatMoney", () => {
  it("writes cedi amounts with the code", () => {
    expect(formatMoney(1234.5, "GHS")).toBe("GHS 1,234.50");
    expect(formatMoney("86.50", "GHS")).toBe("GHS 86.50");
  });

  it("writes other currencies with their symbol", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatMoney(1234.5, "GBP")).toBe("£1,234.50");
    expect(formatMoney(1234.5, "NGN")).toBe("₦1,234.50");
  });
});

describe("formatMoneyCode", () => {
  it("always writes the currency code (for PDFs, whose fonts lack symbols like ₦)", async () => {
    const { formatMoneyCode } = await import("./money");
    expect(formatMoneyCode(1234.5, "NGN")).toBe("NGN 1,234.50");
    expect(formatMoneyCode(86.5, "GHS")).toBe("GHS 86.50");
    expect(formatMoneyCode(1235, "JPY")).toBe("JPY 1,235");
  });
});
