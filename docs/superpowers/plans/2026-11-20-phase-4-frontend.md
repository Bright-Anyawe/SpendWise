# Phase 4: Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every MVP screen working against the real database: app shell, quick add, dashboard, transactions, budgets, reports (with insights and CSV/PDF export) and settings.

**Architecture:** Server Components load data through `src/server/queries` (each read runs as the signed-in person, RLS applies) inside `<Suspense>` boundaries (Cache Components). Client components handle interaction and call the Phase 3 Server Actions; `revalidatePath` refreshes the numbers. View logic that shapes data (chart series, insights, filters, grouping, CSV) lives in pure functions with unit tests. New SQL goes in `src/server/data` with PGlite tests.

**Tech Stack:** Next.js 16.4.6 (Cache Components), React 19, Tailwind 4, shadcn/ui (radix) + `drawer` (vaul) + `dialog` + `sonner`, Recharts 3.11, `@react-pdf/renderer` 4.9, Zod 4, Vitest + PGlite.

**Spec:** `docs/phase-2-design-system.md` (screens §4, charts §5, states §6, a11y §8) and `docs/phase-1-product-plan.md` (§3 MVP, §4 journeys, §6.6 insights).

## Global Constraints

- Tokens and type from `src/app/globals.css` only; Inter; amounts always `tabular-nums`; touch targets ≥ 44px; inputs ≥ 16px.
- Phone (< 768px): bottom bar Home · Transactions · [+] · Budgets · Reports, Settings via the gear on Home. Tablet/desktop (≥ 768px): sidebar, "Add expense" button, shortcut **N**.
- Spending less → green (`text-positive`); spending more → neutral grey; red only when a budget is over. Status never colour-alone.
- Charts: one hue (`--chart-1`), today/current in `--chart-2`, partial periods striped, future days as grey stubs, dashed amber budget line with a label, tooltips, an `aria-label` summary. No donuts, no dual axes.
- Comparisons are like-for-like (database `spending_comparisons`). Insights only when there is enough data; every insight's numbers come from the database.
- Notifications delivery is Phase 5: preferences are saved now and the screen says delivery arrives later. No offline queue yet (Phase 5).
- Copy: plain words, never shaming (Phase 1 §2.4).

## Review Focus

1. **A brand-new account with no expenses**: every screen shows its empty state, no NaN/Infinity or divide-by-zero % → T2/T5 tests `empty data gives empty states`.
2. **Quick add on a phone**: amount `"0"`, `"."`, more than 2 decimals or more than 9 digits can't be typed; Save disabled until amount > 0 → T1 `applyKey` tests.
3. **Transactions URL filters typed by hand** (`?min=abc&category=not-a-uuid&page=-1`) fall back to defaults instead of crashing → T3 `parseTransactionFilters` tests.
4. **Reports for a past period** compare full periods and never show "so far" → T5 `reportData` test.
5. **CSV export with commas, quotes, newlines or leading `=`/`+` in notes** stays one row per expense and can't run as a spreadsheet formula → T5 `toCsv` tests.

---

### Task 1: App shell, navigation and quick add

**Files:** `src/components/shell/{app-shell,bottom-nav,sidebar,add-expense-button}.tsx`, `src/components/quick-add/{quick-add-provider,quick-add-sheet,quick-add-form,keypad,category-grid}.tsx`, `src/lib/keypad.ts` (+test), `src/lib/quick-add.ts` (+test), `src/app/(app)/layout.tsx`, shadcn `drawer dialog sonner select switch`.

**Interfaces — Produces:**
- `applyKey(amount: string, key: string): string` (digits, `"."`, `"del"`; max 2 decimals, max 9 integer digits, no leading zeros).
- `quickAddDefaults(tz: string, lastPaymentMethod: PaymentMethod | null, now?: Date): { spentOn: string; spentTime: string; paymentMethod: PaymentMethod }`.
- `useQuickAdd(): { openNew(): void; openEdit(expense: Expense): void }` (context from `QuickAddProvider`).
- Undo: create → toast "GHS 35.00 · Food & Groceries" with Undo (deleteExpense); delete → toast with Undo (restoreExpense).

- [ ] Tests: `applyKey` (`"" + "0" → "0"`, `"0" + "5" → "5"`, `"12.34" + "5"` unchanged, `"." → "0."`, `"1." + "."` unchanged, 9-digit cap, `del`); `quickAddDefaults` uses the profile time zone and falls back to cash.
- [ ] Implement; shell renders on phone and desktop; N opens quick add on desktop.

### Task 2: Dashboard

**Files:** `src/app/(app)/page.tsx`, `src/components/dashboard/*.tsx`, `src/components/charts/{bar-chart,chart-legend}.tsx`, `src/lib/view/dashboard.ts` (+test).

**Interfaces — Produces:** `comparisonLabel(current, previous, period: "yesterday" | "week" | "month"): { text: string; tone: "less" | "more" | "same" | "none" }`; `budgetLeft(budgets, today): { amount, spent, left, percent, daysLeft, perDay } | null` (monthly overall only); `weekBars(days, today, dailyBudget)`; `monthBars(months, today)`.

- [ ] Tests: labels for less/more/same/no-previous; `budgetLeft` with no budget → null, over budget → perDay null; `empty data gives empty states` (zero totals produce "nothing logged" copy, no NaN).
- [ ] Implement the 9 sections of spec §4.1 plus "No spending today" when today has no expenses.

### Task 3: Transactions

**Files:** `src/app/(app)/transactions/page.tsx`, `src/components/transactions/*.tsx`, `src/lib/view/transactions.ts` (+test).

**Interfaces — Produces:** `parseTransactionFilters(searchParams: Record<string, string | string[] | undefined>, today: string): ExpenseFilters & { period: "month" | "week" | "all" | "custom" }`; `groupByDay(rows: ExpenseWithCategory[], today: string): { day: string; label: string; total: number; rows }[]`.

- [ ] Tests: defaults to this month; bad values dropped; `groupByDay` labels Today / Yesterday / "Tue 17 Nov" and sums each day.
- [ ] Implement search (debounced URL update), filter chips, day groups with totals, Load more, tap to edit, delete with Undo.

### Task 4: Budgets

**Files:** `src/app/(app)/budgets/page.tsx`, `src/components/budgets/*.tsx`, `src/lib/view/budgets.ts` (+test).

**Interfaces — Produces:** `sortBudgets(rows: BudgetStatus[])` (overall monthly → weekly → daily, then categories by state over → warning → ok, then %); `paceNote(monthly: BudgetStatus, today: string): string | null`.

- [ ] Tests for ordering and pace wording (ahead / behind / on pace).
- [ ] Implement list, pace callout, add/edit dialog (period, category, amount, alert %), delete with confirm.

### Task 5: Reports, insights and exports

**Files:** `src/server/data/reports.ts` (+PGlite test), `src/lib/insights.ts` (+test), `src/lib/csv.ts` (+test), `src/app/(app)/reports/page.tsx`, `src/components/reports/*.tsx`, `src/app/api/export/csv/route.ts`, `src/app/api/export/pdf/route.ts`, `src/lib/pdf/report-document.tsx`.

**Interfaces — Produces:** `reportData(db, period: "week" | "month", ref: string): ReportData` (bounds, isCurrent, totals, comparison, days, categories, previousCategories, savings, budgets, loggedDays); `buildInsights(r: ReportData): { id: string; text: string }[]`; `toCsv(rows: ExpenseWithCategory[], currency: string): string`.

- [ ] Tests: `reportData` for a past month uses the full month vs the full previous month; `buildInsights` thresholds (≥ 3 expenses for top category, ≥ 15% change and ≥ 5% share for category change, budget usage only with a budget); `toCsv` quoting and formula-injection guard.
- [ ] Implement page (Week | Month, previous/next), charts, by-category with Savings line, insights, CSV + PDF downloads.

### Task 6: Settings and categories

**Files:** `src/server/data/settings.ts` (+PGlite test), `src/schemas/settings.ts` (+test), `src/server/actions/settings.ts`, `src/app/(app)/settings/page.tsx`, `src/components/settings/*.tsx`.

**Interfaces — Produces:** `updateProfileSettings(db, input)`, `getNotificationPreferences(db)`, `updateNotificationPreferences(db, input)`; actions `saveProfileSettings`, `saveNotificationPreferences`, `changePassword`, `deleteAccount` (password confirmation; Neon Auth `deleteUser`, then `app.delete_my_account()`).

- [ ] Tests: reminder time must be on a 15-minute step; settings update only touches the signed-in person.
- [ ] Implement preferences, categories (add, edit, delete-with-move), notifications (saved; delivery note), data export, account.

### Task 7: States and verification

- [ ] Loading skeletons per screen, empty states (§6), error boundary for the app group.
- [ ] Browser pass at 375px and 1280px on every screen with the real account; `npm run lint && npm run typecheck && npm test && npm run build`.
