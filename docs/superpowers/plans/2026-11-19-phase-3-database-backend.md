# Phase 3: Database & Backend Implementation Plan

> **Superseded backend (2026-11-20):** this plan was executed on Supabase and then ported to **Neon Postgres + Neon Auth**:
> - **Folders:** `supabase/` is now `db/`.
> - **Identity:** `auth.uid()` became `app.current_user_id()` under the `spendwise_user` role.
> - **Code:** Supabase clients were replaced by `pg` and `@neon/auth`, all SQL lives in `src/server/data/`, and sign-in pages moved to `/auth/*`.
>
> The tasks below describe the original Supabase build. See `docs/neon-setup.md` and the README for the current setup.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js 16 app wired to Supabase with the full schema, RLS, analytics functions, auth flows and expense/category/budget server actions, all tested without needing a live Supabase project.

**Architecture:** SQL migrations under `supabase/migrations` are the single source of truth for data rules and every spending number. They are tested in-process with PGlite (Postgres 17 in WASM) plus a minimal stand-in for Supabase's `auth` schema and roles. Next.js Server Actions validate with Zod and call Supabase as the signed-in user, so RLS applies. Pure TypeScript helpers (money, dates, calculations) are unit-tested with Vitest.

**Tech Stack:** Next.js 16.4.6, React 19.3.1, TypeScript, Tailwind 4.3.5, shadcn/ui, Zod 4.6.7, react-hook-form 7.92.0, @supabase/ssr 0.12.7, @supabase/supabase-js 2.119.2, Vitest, @electric-sql/pglite.

**Spec:** `docs/phase-1-product-plan.md` (§6–§9) and `docs/phase-2-design-system.md`.

## Global Constraints

- Money is `numeric(14,2)`, always `> 0`; sent to the DB as a decimal **string**, never summed as floats in JS.
- Bucketing uses `spent_on` (the user's local calendar date) only. **Refinement of Phase 1:** the user's local wall-clock time is stored as `spent_time` (`time`), and `spent_at` (`timestamptz`) is derived by a trigger from `spent_on + spent_time` in the profile's time zone. Clients never write `spent_at`.
- "Today" = `(now() at time zone profiles.timezone)::date`; weeks start on `profiles.week_starts_on` (0 = Sunday … 6 = Saturday, default 1).
- Comparisons are like-for-like: same number of days from the start of the previous period, capped at that period's end.
- RLS on every table, policies use `(select auth.uid())`. `anon` gets no table privileges. Ownership across tables uses composite FKs `(x_id, user_id)`.
- `SUPABASE_SECRET_KEY` is only imported from files that `import 'server-only'`.
- Categories seeded per user: Food & Groceries · Transportation · Rent & Housing · Utilities & Bills · Shopping · Healthcare · Education · Entertainment · Family & Gifts · Business · Savings (`counts_as_spending = false`) · Other (`is_fallback = true`).
- Payment methods: `cash`, `mobile_money`, `card`, `bank_transfer`, `other`.
- Budget state: `over` if spent > amount; `warning` if spent ≥ amount × alert% / 100; else `ok`.
- User-facing copy: plain words, no jargon, never shaming (Phase 1 §2.4).

## Review Focus

1. **Expense near midnight or across DST in a non-UTC zone** must land on the date the user picked, and `spent_at` must be the correct instant → Task 3 test `derives spent_at in the profile time zone (London summer)`.
2. **Month-end comparisons** (31 March vs February) must cap at the shorter month's end, not spill into March → Task 5 test `caps previous month window at month end`.
3. **Deleting a category that has expenses, or the fallback category** must never orphan or lose expenses → Task 5 tests `delete_category moves expenses` / `refuses to delete fallback`.
4. **Messy amount input** (`"1,234.5"`, `" 35 "`, `"0"`, `"-5"`, `"12.345"`, `"abc"`, `"1e3"`) → Task 2 `parseAmount` tests.
5. **Offline retry re-sending the same expense id** must not create a duplicate or overwrite later edits → Task 4 test `same id inserted twice keeps one row`.

---

### Task 1: Scaffold and tooling

**Files:** create the Next.js app at the repo root (`package.json`, `tsconfig.json`, `next.config.ts`, `src/app/*`, `eslint.config.mjs`), `vitest.config.ts`, `src/config/brand.ts`, `src/config/currencies.ts`, `.env.example`, `.gitignore`.

**Interfaces — Produces:**
- `BRAND: { name: string; tagline: string }`, with `name = "SpendWise"` until the rename is confirmed.
- `CURRENCIES: readonly { code: string; name: string; display: 'code' | 'symbol' }[]` (GHS `code`; USD, GBP, EUR, NGN, KES, ZAR, XOF, CAD, AUD, INR, JPY `symbol`); `isSupportedCurrency(code: string): boolean`.
- npm scripts: `dev`, `build`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`).

- [ ] Scaffold with create-next-app 16.4.6 (TS, Tailwind, ESLint, App Router, `src/`, `@/*`, npm) and install runtime + dev deps at the versions above.
- [ ] Vitest config: node environment, `@` → `src`, includes `src/**/*.test.ts` and `supabase/tests/**/*.test.ts`.
- [ ] Test `src/config/currencies.test.ts`: `isSupportedCurrency('GHS') === true`, `isSupportedCurrency('XYZ') === false`, and every code matches `/^[A-Z]{3}$/`.
- [ ] Run `npm test` → PASS; `npm run typecheck` → no errors.

### Task 2: Pure helpers (money, dates, calculations, search)

**Files:** `src/lib/money.ts`, `src/lib/dates.ts`, `src/lib/calc.ts`, `src/lib/search.ts` with sibling `*.test.ts`.

**Interfaces — Produces:**
- `parseAmount(input: string): string | null` → normalized `"1234.50"`, or null if invalid. Rules: trim, strip `,` thousands separators, digits with optional `.` and ≤ 2 decimals, value > 0 and ≤ 999 999 999.99.
- `formatMoney(amount: number | string, currency: string, locale = 'en-GH'): string` → GHS `"GHS 1,234.50"`; USD `"$1,234.50"`.
- `todayInTimeZone(tz: string, now?: Date): string` (`YYYY-MM-DD`); `timeInTimeZone(tz: string, now?: Date): string` (`HH:mm`); `isValidTimeZone(tz: string): boolean`.
- `percentChange(current: number, previous: number): number | null` (null when previous is 0); `dailyAllowance(remaining: number, daysLeftIncludingToday: number): number | null` (null when ≤ 0 days or remaining ≤ 0); `budgetState(spent: number, amount: number, alertAtPercent: number): 'ok' | 'warning' | 'over'`.
- `toIlikePattern(query: string): string | null` → escapes `\ % _`, removes `, ( ) " '`, wraps in `%…%`; null if empty after cleaning.

- [ ] Tests first, including: `parseAmount('1,234.5') === '1234.50'`, `parseAmount(' 35 ') === '35.00'`, `parseAmount('0') === null`, `'-5'`, `'12.345'`, `'abc'`, `'1e3'` → null; `percentChange(86.5, 112)` ≈ `-22.77`; `dailyAllowance(815.7, 12)` ≈ `67.975`; `budgetState(418, 400, 80) === 'over'`, `(320, 400, 80) === 'warning'`, `(319.99, 400, 80) === 'ok'`; `todayInTimeZone('Pacific/Auckland', new Date('2026-11-19T12:00:00Z')) === '2026-11-20'`; `toIlikePattern('a,b(c)%') === '%abc\\%%'`.
- [ ] Run → FAIL; implement; run → PASS.

### Task 3: Schema migration + PGlite test harness

**Files:** `supabase/migrations/20261119000001_schema.sql`, `supabase/tests/helpers/db.ts`, `supabase/tests/helpers/auth-stub.sql`, `supabase/tests/schema.test.ts`.

**Interfaces — Produces:**
- Tables per Phase 1 §7.2 plus `expenses.spent_time time not null`. Trigger `expenses_set_spent_at` (BEFORE INSERT OR UPDATE OF spent_on, spent_time). Trigger `set_updated_at` on mutable tables. `handle_new_user()` AFTER INSERT on `auth.users` seeds profile, notification_preferences and the 12 categories (display_name from `raw_user_meta_data->>'display_name'`). `is_valid_timezone(text)`.
- FKs from children to categories use the default NO ACTION, so deleting an account cascades cleanly. `budgets → categories` uses ON DELETE CASCADE.
- Test helper `createTestDb(): Promise<TestDb>` with `db.asUser(userId, fn)`, `db.asAnon(fn)`, `db.asService(fn)`, `db.createUser(opts?): Promise<string>` (inserts into `auth.users` as superuser and returns the id).

- [ ] Tests: `seeds profile, preferences and 12 categories on sign-up`; `Savings does not count as spending and Other is the fallback`; `derives spent_at in the profile time zone (London summer)` (`2026-07-01` + `12:30` → `2026-07-01T11:30:00Z`); `rejects amount <= 0 and notes over 280 chars`; `rejects invalid time zone`; `deleting the auth user removes all their rows`.
- [ ] Run → FAIL; write the migration and harness; run → PASS.

### Task 4: RLS and privileges migration

**Files:** `supabase/migrations/20261119000002_rls.sql`, `supabase/tests/rls.test.ts`.

**Interfaces — Produces:** RLS + four policies per table (notifications: select + update only). Column grants: `categories` insert/update (name, icon, color, sort_order, counts_as_spending); `expenses` insert (id, amount, category_id, payment_method, note, spent_on, spent_time) and update (same minus id); `notifications` update (read_at). `revoke all … from anon`.

- [ ] Tests: `user cannot read another user's rows` (every table); `user cannot update or delete another user's expense` (0 rows changed); `cannot attach an expense to another user's category` (FK error); `cannot insert with someone else's user_id` (RLS error); `cannot set is_fallback or spent_at directly` (permission denied); `anon sees nothing`; `same id inserted twice keeps one row` (`on conflict (id) do nothing`).
- [ ] Run → FAIL; implement; run → PASS.

### Task 5: Analytics and category functions

**Files:** `supabase/migrations/20261119000003_functions.sql`, `supabase/tests/analytics.test.ts`.

**Interfaces — Produces** (all `security invoker`, `set search_path = ''`, executable by `authenticated` only; `p_ref` defaults to `local_today()`):
- `local_today() returns date`
- `period_bounds(p_kind text, p_ref date) returns table(start_date date, end_date date)`, where `p_kind` ∈ `day|week|month`
- `spending_total(p_from date, p_to date) returns table(total numeric, expense_count int)` (spending categories only)
- `spending_by_category(p_from date, p_to date) returns table(category_id uuid, name text, icon text, counts_as_spending boolean, total numeric, expense_count int, share numeric)` (share = % of spending total, null for non-spending; ordered by total desc)
- `daily_totals(p_from date, p_to date) returns table(day date, total numeric, expense_count int)` (zero-filled)
- `monthly_totals(p_months int, p_ref date default null) returns table(month_start date, total numeric)` (zero-filled, oldest first)
- `spending_comparisons(p_ref date default null) returns table(kind text, current_start date, current_end date, current_total numeric, current_count int, previous_start date, previous_end date, previous_total numeric)`, with three rows: day, week, month
- `budget_status(p_ref date default null) returns table(budget_id uuid, period budget_period, category_id uuid, category_name text, amount numeric, spent numeric, remaining numeric, used_percent numeric, alert_at_percent smallint, state text, period_start date, period_end date)`
- `delete_category(p_category_id uuid, p_move_to uuid) returns void`

- [ ] Tests: `spending_total excludes Savings`; `daily_totals fills empty days with 0`; `week starts on the profile's week start` (Monday and Sunday); `compares the same days of the previous week`; `caps previous month window at month end` (ref 2027-03-31 → previous 2027-02-01..2027-02-28); `budget_status reports ok, warning and over`; `overall budget ignores Savings`; `delete_category moves expenses`; `refuses to delete fallback`; `refuses to move into another user's category`.
- [ ] Run → FAIL; implement; run → PASS.

### Task 6: Supabase clients, proxy, auth flows, onboarding

**Files:** `src/lib/supabase/{client,server,admin,proxy}.ts`, `src/proxy.ts`, `src/lib/auth/redirect.ts` (+ test), `src/schemas/auth.ts`, `src/schemas/profile.ts` (+ tests), `src/server/actions/{auth,profile}.ts`, `src/server/action-result.ts`, `src/app/(auth)/{login,signup,forgot-password,reset-password}/page.tsx`, `src/app/auth/confirm/route.ts`, `src/app/onboarding/page.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx` (placeholder home until Phase 4), shadcn primitives used by the forms.

**Interfaces — Produces:**
- `createClient()` (browser) / `createServerSupabase()` (server, cookies) / `createAdminClient()` (secret key, `server-only`); `updateSession(request: NextRequest): Promise<NextResponse>`.
- `safeNextPath(next: string | null | undefined): string` → only same-origin relative paths starting with a single `/`, else `/`.
- `type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }`.
- Actions: `signUp`, `signIn`, `signOut`, `requestPasswordReset`, `updatePassword`, `completeOnboarding({ displayName?, currency, timezone, weekStartsOn, monthlyBudget? })`.
- Routing: signed-out users are redirected from app routes to `/login?next=…`; signed-in users who haven't onboarded go to `/onboarding`.

- [ ] Tests: `safeNextPath('//evil.com') === '/'`, `('https://x.y') === '/'`, `('/transactions?x=1')` unchanged; sign-up schema rejects passwords under 8 characters and malformed emails; onboarding schema rejects unknown currency, invalid time zone and `weekStartsOn: 7`.
- [ ] Run → FAIL; implement; run → PASS; `npm run build` succeeds.

### Task 7: Expense, category, budget actions and queries

**Files:** `src/schemas/{expense,category,budget}.ts` (+ tests), `src/server/actions/{expenses,categories,budgets,no-spend}.ts`, `src/server/queries/{profile,categories,expenses,dashboard,budgets}.ts`, `src/lib/types/database.ts` (hand-written row types matching the migrations).

**Interfaces — Produces:**
- `expenseInputSchema` → `{ id?: string; amount: string; categoryId: string; paymentMethod: PaymentMethod; note?: string; spentOn: string; spentTime: string }`; `toExpenseRow(input): ExpenseInsert` (amount as a normalized string, note trimmed, empty → null).
- Actions: `createExpense`, `updateExpense(id, input)`, `deleteExpense(id): ActionResult<Expense>` (returns the deleted row for undo), `restoreExpense(row)`, `createCategory`, `updateCategory`, `deleteCategory(id, moveTo)`, `saveBudget`, `deleteBudget`, `markNoSpendDay(day)`. All call `revalidatePath('/', 'layout')` on success.
- Queries: `getProfile()`, `getCategories()`, `listExpenses(filters: { from?, to?, categoryIds?, paymentMethods?, minAmount?, maxAmount?, q?, page? })` (50 per page, newest first), `getDashboardData(ref?)` (comparisons, by-category, daily totals for the week, monthly totals ×6, budget status, today's expenses, in parallel), `getBudgetStatus(ref?)`.

- [ ] Tests: `toExpenseRow` normalizes `"1,234.5"` → `"1234.50"` and blank note → null; expense schema rejects an unknown payment method, `spentOn: '2026-02-30'` and `spentTime: '25:00'`; budget schema rejects `alertAtPercent: 0`; category schema trims names and rejects names over 40 chars.
- [ ] Run → FAIL; implement; run → PASS.

### Task 8: Setup guide and full verification

**Files:** `docs/supabase-setup.md`, `README.md`.

- [ ] Guide covers: create project → apply migrations (CLI `db push` or SQL Editor in order) → Auth URL configuration and redirect URLs → email templates using `{{ .TokenHash }}` with `/auth/confirm` → custom SMTP → `.env.local` → what is still external.
- [ ] Run `npm run lint && npm run typecheck && npm test && npm run build` → all pass.
