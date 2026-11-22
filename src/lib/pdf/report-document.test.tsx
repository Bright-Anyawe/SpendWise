import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type { ReportData } from "@/server/data/reports";
import { ReportDocument } from "./report-document";

const report: ReportData = {
  period: "month",
  start: "2026-10-01",
  end: "2026-10-31",
  today: "2026-11-19",
  isCurrent: false,
  upTo: "2026-10-31",
  total: 3310,
  count: 2,
  previous: { start: "2026-09-01", end: "2026-09-30", total: 2960 },
  days: [],
  categories: [
    { category_id: "f", name: "Food & Groceries", icon: "utensils", counts_as_spending: true, total: 3310, expense_count: 2, share: 100 },
  ],
  previousCategories: [],
  budgets: [],
  loggedDays: 0,
};

describe("ReportDocument", () => {
  it("renders a PDF with the expenses", async () => {
    const pdf = await renderToBuffer(
      <ReportDocument
        report={report}
        title="October 2026"
        comparison="12% more than September"
        insights={[{ id: "x", text: "Food & Groceries is your highest spending category in October." }]}
        expenses={[
          {
            id: "1", user_id: "u", amount: 3300, category_id: "f", payment_method: "mobile_money", note: "Rent, 'October'",
            spent_on: "2026-10-01", spent_time: "09:00:00", spent_at: "", created_at: "", updated_at: "",
            category: { name: "Food & Groceries", icon: "utensils" },
          },
        ]}
        money={(n) => `GHS ${n.toFixed(2)}`}
      />,
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
