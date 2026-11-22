import { describe, expect, it } from "vitest";
import { budgetState, dailyAllowance, percentChange } from "./calc";

describe("percentChange", () => {
  it("returns the change from previous to current in percent", () => {
    expect(percentChange(86.5, 112)).toBeCloseTo(-22.77, 2);
    expect(percentChange(2184.3, 2036)).toBeCloseTo(7.28, 2);
  });

  it("returns null when there is nothing to compare against", () => {
    expect(percentChange(50, 0)).toBeNull();
  });
});

describe("dailyAllowance", () => {
  it("splits what is left over the remaining days", () => {
    expect(dailyAllowance(815.7, 12)).toBeCloseTo(67.975, 3);
  });

  it("returns null when nothing is left or no days remain", () => {
    expect(dailyAllowance(0, 12)).toBeNull();
    expect(dailyAllowance(-18, 12)).toBeNull();
    expect(dailyAllowance(100, 0)).toBeNull();
  });
});

describe("budgetState", () => {
  it("is over only when spending exceeds the budget", () => {
    expect(budgetState(418, 400, 80)).toBe("over");
    expect(budgetState(400, 400, 80)).toBe("warning");
  });

  it("warns from the alert point", () => {
    expect(budgetState(320, 400, 80)).toBe("warning");
    expect(budgetState(319.99, 400, 80)).toBe("ok");
  });
});
