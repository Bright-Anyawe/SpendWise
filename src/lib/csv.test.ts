import { describe, expect, it } from "vitest";
import type { ExpenseWithCategory } from "@/lib/types/database";
import { toCsv } from "./csv";

function row(overrides: Partial<ExpenseWithCategory>): ExpenseWithCategory {
  return {
    id: "1",
    user_id: "u",
    amount: 35,
    category_id: "c",
    payment_method: "mobile_money",
    note: null,
    spent_on: "2026-11-19",
    spent_time: "12:30:00",
    spent_at: "",
    created_at: "",
    updated_at: "",
    category: { name: "Food & Groceries", icon: "utensils" },
    ...overrides,
  };
}

describe("toCsv", () => {
  it("writes a header and one line per expense, with a BOM for Excel", () => {
    const csv = toCsv([row({ note: "Lunch" })], "GHS");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      "Date,Time,Amount,Currency,Category,Payment method,Note",
      "2026-11-19,12:30,35.00,GHS,Food & Groceries,Mobile Money,Lunch",
      "",
    ]);
  });

  it("quotes commas, quotes and line breaks so each expense stays one row", () => {
    const line = toCsv([row({ note: 'Lunch, "waakye"\nwith Kofi' })], "GHS").slice(1).split("\r\n")[1];
    expect(line).toBe('2026-11-19,12:30,35.00,GHS,Food & Groceries,Mobile Money,"Lunch, ""waakye""\nwith Kofi"');
  });

  it("stops notes from running as spreadsheet formulas", () => {
    for (const note of ["=HYPERLINK(1)", "+1", "-2", "@SUM(A1)"]) {
      const line = toCsv([row({ note })], "GHS").slice(1).split("\r\n")[1];
      expect(line.endsWith(`,'${note}`) || line.endsWith(`,"'${note}"`), note).toBe(true);
    }
  });
});
