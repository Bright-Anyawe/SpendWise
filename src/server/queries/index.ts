import "server-only";
import { cache } from "react";
import type { BudgetStatus, Category, ExpenseWithCategory } from "@/lib/types/database";
import { expenseFiltersSchema } from "@/schemas/expense";
import { asCurrentUser } from "../auth";
import { budgetStatus } from "../data/budgets";
import { listCategories } from "../data/categories";
import { type DashboardData, dashboardData } from "../data/dashboard";
import { type ReportData, type ReportPeriod, reportData } from "../data/reports";
import { type InboxNotification, listNotifications, unreadNotificationCount } from "../data/notifications";
import { getNotificationPreferences as getNotificationPreferencesData, type NotificationPreferences } from "../data/settings";
import { listExpenses as listExpensesData, quickAddOptions, summarizeExpenses as summarizeExpensesData } from "../data/expenses";

export function getQuickAddOptions() {
  return asCurrentUser(quickAddOptions);
}

// Read-side entry points for Server Components. Each runs as the signed-in person (RLS applies).

export type { DashboardData };

export function getDashboardData(ref?: string): Promise<DashboardData> {
  return asCurrentUser((db) => dashboardData(db, ref));
}

/** The person's categories in display order. Deduplicated per request. */
export const getCategories = cache((): Promise<Category[]> => asCurrentUser(listCategories));

export function getReportData(period: ReportPeriod, ref: string): Promise<ReportData> {
  return asCurrentUser((db) => reportData(db, period, ref));
}

export function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  return asCurrentUser(getNotificationPreferencesData);
}

export function getNotifications(): Promise<InboxNotification[]> {
  return asCurrentUser((db) => listNotifications(db));
}

export function getUnreadNotificationCount(): Promise<number> {
  return asCurrentUser(unreadNotificationCount);
}

export function getBudgetStatus(ref?: string): Promise<BudgetStatus[]> {
  return asCurrentUser((db) => budgetStatus(db, ref));
}

/** Newest first; `filters` is validated here. `pageSize` rows from `filters.page`. */
export function listExpenses(filters: unknown = {}, pageSize?: number): Promise<{ rows: ExpenseWithCategory[]; hasMore: boolean }> {
  const parsed = expenseFiltersSchema.parse(filters);
  return asCurrentUser((db) => listExpensesData(db, parsed, pageSize));
}

/** Count and total of everything the filters match. */
export function summarizeExpenses(filters: unknown = {}): Promise<{ count: number; total: number }> {
  const parsed = expenseFiltersSchema.parse(filters);
  return asCurrentUser((db) => summarizeExpensesData(db, parsed));
}
