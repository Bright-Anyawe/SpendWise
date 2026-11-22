import { describe, expect, it } from "vitest";
import {
  budgetExceededCopy,
  budgetWarningCopy,
  changePhrase,
  dailyReminderCopy,
  eveningReviewCopy,
  monthlySummaryCopy,
  weeklySummaryCopy,
} from "./copy";

describe("notification copy (Phase 2 §7)", () => {
  it("daily reminder offers Add expense and No spending today", () => {
    const c = dailyReminderCopy();
    expect(c.title).toBe("Nothing logged today");
    expect(c.actions?.map((a) => a.action)).toEqual(["add", "no-spend"]);
  });

  it("evening review compares with yesterday", () => {
    expect(eveningReviewCopy({ total: 86.5, count: 4, yesterday: 112.34, currency: "GHS" })).toMatchObject({
      title: "Today: GHS 86.50",
      body: "4 expenses, 23% less than yesterday.",
    });
    expect(eveningReviewCopy({ total: 20, count: 1, yesterday: 0, currency: "GHS" }).body).toBe("1 expense logged.");
  });

  it("weekly summary names the top category", () => {
    expect(weeklySummaryCopy({ weekStart: "2026-11-16", total: 640, previous: 703.3, topCategory: "Food & Groceries", currency: "GHS" })).toEqual({
      title: "Last week: GHS 640.00",
      body: "9% less than the week before. Food & Groceries was your top category.",
      url: "/reports?period=week&ref=2026-11-16",
    });
    expect(weeklySummaryCopy({ weekStart: "2026-11-16", total: 0, previous: 50, topCategory: null, currency: "GHS" }).body).toBe(
      "No spending logged last week.",
    );
  });

  it("monthly summary compares with the monthly budget", () => {
    expect(monthlySummaryCopy({ monthStart: "2026-10-01", total: 3310, budget: 3000, currency: "GHS" })).toEqual({
      title: "October: GHS 3,310.00",
      body: "GHS 310.00 over your monthly budget. Here’s where it went.",
      url: "/reports?ref=2026-10-01",
    });
    expect(monthlySummaryCopy({ monthStart: "2026-10-01", total: 2500, budget: 3000, currency: "GHS" }).body).toBe(
      "GHS 500.00 under your monthly budget. Here’s where it went.",
    );
    expect(monthlySummaryCopy({ monthStart: "2026-10-01", total: 2500, budget: null, currency: "GHS" }).body).toBe("Here’s where it went.");
  });

  it("budget alerts", () => {
    const facts = { period: "monthly" as const, categoryName: "Food & Groceries", usedPercent: 80.4, remaining: 160, periodStart: "2026-11-01", currency: "GHS" };
    expect(budgetWarningCopy(facts)).toMatchObject({ title: "Food & Groceries is at 80%", body: "GHS 160.00 left for the rest of November." });
    expect(budgetExceededCopy({ ...facts, categoryName: "Transportation", remaining: -18 })).toMatchObject({
      title: "Transportation is over budget",
      body: "GHS 18.00 over for November.",
    });
    expect(budgetWarningCopy({ ...facts, period: "weekly", categoryName: null }).title).toBe("Your weekly budget is at 80%");
  });

  it("changePhrase", () => {
    expect(changePhrase(100, 100, "yesterday")).toBe("the same as yesterday");
    expect(changePhrase(150, 100, "yesterday")).toBe("50% more than yesterday");
    expect(changePhrase(10, 0, "yesterday")).toBeNull();
  });
});
