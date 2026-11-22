import { describe, expect, it } from "vitest";
import { quickAddDefaults } from "./quick-add";

describe("quickAddDefaults", () => {
  it("uses the date and time in the person's time zone", () => {
    const now = new Date("2026-11-19T23:30:00Z");
    expect(quickAddDefaults("Pacific/Auckland", "mobile_money", now)).toEqual({
      spentOn: "2026-11-20",
      spentTime: "12:30",
      paymentMethod: "mobile_money",
    });
  });

  it("falls back to cash when nothing has been logged yet", () => {
    expect(quickAddDefaults("Africa/Accra", null, new Date("2026-11-19T07:45:00Z")).paymentMethod).toBe("cash");
  });
});
