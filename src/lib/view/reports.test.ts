import { describe, expect, it } from "vitest";
import type { DailyTotal } from "@/lib/types/database";
import { dayBars, periodNav } from "./reports";

describe("periodNav", () => {
  it("labels months and weeks and steps backwards and forwards", () => {
    expect(periodNav("month", "2026-11-01", "2026-11-30", "2026-11-19")).toEqual({
      label: "November 2026",
      prevRef: "2026-10-01",
      nextRef: null,
    });
    expect(periodNav("month", "2026-10-01", "2026-10-31", "2026-11-19")).toEqual({
      label: "October 2026",
      prevRef: "2026-09-01",
      nextRef: "2026-11-01",
    });
    expect(periodNav("week", "2026-11-09", "2026-11-15", "2026-11-19")).toEqual({
      label: "9–15 Nov",
      prevRef: "2026-11-02",
      nextRef: "2026-11-16",
    });
  });
});

describe("dayBars", () => {
  it("labels a few days in a month so the axis stays readable", () => {
    const days: DailyTotal[] = Array.from({ length: 30 }, (_, i) => ({
      day: `2026-11-${String(i + 1).padStart(2, "0")}`,
      total: i < 19 ? 10 : 0,
      expense_count: 0,
    }));
    const bars = dayBars(days, "2026-11-19", "month");
    expect(bars.filter((b) => b.label).map((b) => b.label)).toEqual(["1", "8", "15", "19", "22", "29"]);
    expect(bars[18].kind).toBe("today");
    expect(bars[25].kind).toBe("future");
  });
});
