# Phase 2: UI/UX Design System & Screen Specs

**Status:** Draft for approval · **Date:** 2026-11-19 · **Builds on:** [phase-1-product-plan.md](phase-1-product-plan.md)

**Mockups:** [Pesewa App Screens canvas](https://claude.ai/artifact/Di783GaMichfZ7HyqpeQ9P) (private until shared). It contains 7 phone screens, a desktop dashboard and a design system sheet. Press **Play** on a phone screen to click through it: the bottom nav and **+** button move between screens, the quick-add keypad works, Reports switches Week/Month, and Settings toggles flip.

All names and amounts in the mockups are **sample data for layout only**. They are internally consistent (today → week → month → budgets) so the maths can be checked, but none of it is seeded into the app.

Anything marked **[Call]** is a design decision I made that you haven't confirmed yet.

---

## 1. Design principles

1. **Logging is the hero.** The **+** button is visible on every screen; quick add opens with the amount ready and needs at most 3 taps after typing.
2. **One number first.** Every screen leads with the single figure that answers its question (spent today, money left, total this period).
3. **One accent per screen.** Deep emerald is reserved for the primary action and one highlight card. Everything else stays neutral.
4. **Kind, honest feedback.** Spending less shows in green; spending more is shown in neutral grey, never red. Red appears only when a budget is actually exceeded.
5. **Never colour alone.** Status always comes with an icon and words; charts carry labels or an accessible text alternative.

---

## 2. Tokens

### 2.1 Colour

Changes from Phase 1: the positive text colour is now `#166534` (higher contrast than `#15803D`), and a separate chart colour was added.

| Token | Hex | Contrast on white | Use |
|---|---|---|---|
| `--primary` | `#065F46` | 7.7:1 | Primary buttons, active nav, highlight card |
| `--primary-hover` | `#047857` | 5.5:1 | Hover/pressed, links |
| `--chart` | `#059669` | 3.8:1 | Bars and data marks |
| `--mint-400` | `#6EE7B7` | — | Accents **on emerald only** (5.0:1 there) |
| `--mint` | `#D1FAE5` | — | Text on emerald (6.8:1) |
| `--mint-tint` | `#E7F6EE` | — | Icon tiles, selected chips, info callouts |
| `--background` | `#F7F9F8` | — | App background |
| `--surface` | `#FFFFFF` | — | Cards, sheets |
| `--border` | `#E3E8E5` | — | Card hairlines |
| `--input-border` | `#D7DDD9` | — | Inputs, unselected chips |
| `--track` | `#EEF2F0` | — | Progress tracks, row dividers |
| `--foreground` | `#1F2937` | 14.7:1 | Body text |
| `--muted-foreground` | `#4B5563` | 7.6:1 | Secondary text, labels |
| `--positive` | `#166534` on `#E7F6EE` | 7.1:1 | Less spent, on track |
| `--warning` | text `#92400E` on `#FEF3C7`; fill `#D97706`; budget line `#B45309` | 6.4:1 / 3.2:1 / 5.0:1 | Close to limit, budget reference lines |
| `--danger` | text `#B91C1C` on `#FEE2E2`; fill `#DC2626` | 6.5:1 / 4.8:1 | Over budget, destructive actions |

### 2.2 Tailwind v4 + shadcn/ui mapping (`src/app/globals.css`)

```css
@import "tailwindcss";

:root {
  --radius: 0.75rem;                 /* 12px controls */
  --background: #F7F9F8;
  --foreground: #1F2937;
  --card: #FFFFFF;
  --card-foreground: #1F2937;
  --popover: #FFFFFF;
  --popover-foreground: #1F2937;
  --primary: #065F46;
  --primary-foreground: #FFFFFF;
  --secondary: #E7F6EE;
  --secondary-foreground: #065F46;
  --muted: #EEF2F0;
  --muted-foreground: #4B5563;
  --accent: #E7F6EE;
  --accent-foreground: #065F46;
  --destructive: #B91C1C;
  --border: #E3E8E5;
  --input: #D7DDD9;
  --ring: #047857;
  --chart-1: #059669;                /* bars */
  --chart-2: #065F46;                /* current / today */
  --chart-3: #A7F3D0;                /* stripe for partial periods */
  --positive: #166534;
  --positive-bg: #E7F6EE;
  --warning: #92400E;
  --warning-bg: #FEF3C7;
  --warning-fill: #D97706;
  --danger-bg: #FEE2E2;
  --danger-fill: #DC2626;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-positive: var(--positive);
  --color-warning: var(--warning);
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --radius-sm: 10px;   /* icon tiles */
  --radius-md: 12px;   /* controls */
  --radius-lg: 16px;   /* cards */
  --radius-xl: 20px;   /* hero cards */
  --radius-2xl: 24px;  /* sheets */
}
```

Dark mode is a post-MVP fast-follow; tokens are named by role so a `.dark` block can be added without touching components.

### 2.3 Typography: Inter (`next/font/google`)

| Role | Size / line | Weight | Notes |
|---|---|---|---|
| Hero amount | 40/44 (desktop 28–36) | 600 | `-0.02em`, tabular figures |
| Screen title | 24/32 | 600 | |
| Section title | 17/24 | 600 | |
| Body | 15/22 | 400–500 | |
| Label | 13/18 | 500 | Muted colour |
| Caption | 12/16 | 500 | |
| Nav label | 11/14 | 500 (600 active) | |

- Every amount uses `font-variant-numeric: tabular-nums` (Tailwind `tabular-nums`).
- Inputs are **16px minimum** so iOS Safari doesn't zoom in.

### 2.4 Space, shape, elevation, motion

- **Spacing:** 4px base (4, 8, 12, 16, 20, 24, 32). Phone side margins 20px; card padding 16–20px; gap between cards 14–16px.
- **Radius:** 10 icon tile · 12 control · 16 card · 20 hero card · 24 sheet top · full for pills.
- **Elevation:** cards use a 1px hairline, no shadow. Shadows only on floating elements (add button, sheet, toast, dialogs).
- **Touch targets:** at least 44 × 44px.
- **Motion:** 150–250ms ease-out. Sheets slide up, toasts fade and rise. Disabled under `prefers-reduced-motion`.

### 2.5 Currency display **[Call]**

`Intl.NumberFormat` with a per-currency display rule in `src/config/currencies.ts`:
- GHS shows the code: **GHS 1,234.50** (the ₵ glyph isn't reliable across fonts and keyboards, and "GHS" is widely used on receipts).
- USD, GBP, EUR, NGN and others show their symbol: **$1,234.50**, **£1,234.50**, **€1,234.50**, **₦1,234.50**.

---

## 3. Layout shells

| Width | Navigation | Quick add |
|---|---|---|
| < 768px (phone) | Bottom bar: Home · Transactions · **[+]** · Budgets · Reports. Settings via the gear on Home. | Bottom sheet (shadcn `Drawer`) with in-app keypad |
| 768–1023px (tablet) | Icon rail on the left | Centred dialog, keypad shown |
| ≥ 1024px (desktop) | 240px sidebar with labels; "Add expense" button top right; keyboard shortcut **N** | Centred dialog; normal keyboard input, no keypad |

Content max width on desktop is 1200px. Grids use `auto-fit` so cards stack naturally on smaller screens.

---

## 4. Screen specs

Order on the page = order listed. Each item maps to a component in Phase 4.

### 4.1 Dashboard (Home)
1. Greeting + date, notifications bell (unread dot), settings gear.
2. **Spent today** hero: amount, number of expenses, comparison with yesterday.
3. **Left this month** emerald card: remaining amount, days to go, progress bar, spent vs budget, daily allowance sentence. *(No monthly budget → card becomes "Set a monthly budget" prompt.)*
4. Two tiles: **This week** and **This month**, each with a like-for-like comparison.
5. **Today**: up to 5 most recent expenses, "See all".
6. **This week** bar chart: Mon–Sun, today darker, future days as grey stubs, dashed daily-budget line, highest day named below.
7. **Where it went** (this month): top 5 categories as ranked bars with amount and %; link to all.
8. **Budgets to watch**: up to 3 budgets, ordered over → highest %; "Manage".
9. **Last 6 months** bars, current month striped as "so far", dashed monthly-budget line.

All 10 dashboard requirements from the brief are covered (items 2–9 plus the + button and the remaining-budget card).

### 4.2 Quick add (the most important screen)
- Opens with the **amount focused**. Phone: in-app keypad **[Call]** (faster than the system keyboard, no layout jump, and the decimal key is always there). Desktop: normal input.
- **Category grid**: 8 tiles (top 7 by how often you use them, plus More). One tap selects.
- **Meta pills**: date/time (defaults to now), payment method (defaults to last used), add note.
- **Save** button shows the amount ("Save GHS 35.00"); disabled with "Enter an amount" when empty.
- After saving: sheet closes, toast "GHS 35.00 · Food & Groceries · Undo", numbers update immediately (optimistic).
- Target: amount + 1 tap + Save. **"Save & add another"** via long-press or a secondary action (Phase 4 detail).
- The same component is reused for **editing** (prefilled, with Delete).

### 4.3 Transactions
- Title + export button; search (notes and category names); filter chips in a horizontally scrolling row: period, category, payment method, amount range.
- Summary line: period, count, total.
- Expenses grouped by day with a daily total; row = icon tile, note (or category name if no note), "category · payment · time", amount.
- Tap a row → edit sheet. Delete → **Undo toast** for 5 seconds.
- Offline-queued expenses show a "Waiting to sync" badge and are included in totals.

### 4.4 Budgets
- Pace callout when relevant ("73% used, 63% of November gone").
- **Overall**: monthly, weekly, daily. **Categories (this month)**: any number.
- Each row: name, status pill (On track / Close to limit / Over budget), progress bar with an **alert-point tick at 80%**, "spent of budget", and "left" or "over".
- Dashed "Add a category budget" button; note explaining alerts with a link to Settings.

### 4.5 Reports
- **Week | Month** segmented control + previous/next period.
- Summary: total, like-for-like comparison, expenses count, daily average, highest day.
- **Day by day** bars with the daily-budget line (month view labels days 1, 8, 15, 22, 29 and today).
- **By category**: every category, ranked; a separate **"Set aside to Savings"** line (not counted as spending).
- **What stands out**: rule-based insights (Phase 1 §6.6). The caption makes clear they are calculated from the user's records.
- **Export**: CSV and PDF for the selected period.

### 4.6 Settings & notifications
- Profile card → edit name/email.
- **Preferences**: currency, time zone, week start, categories (manage screen).
- **Reminders and notifications**: device status callout (with iPhone Home Screen guidance), daily reminder + time (15-minute steps), evening review, weekly summary, monthly summary, budget alerts. Footnote: max 3 notifications a day, never a reminder and a review on the same evening.
- **Your data**: export all expenses (CSV).
- **Account**: change password, log out, delete account (explains it's permanent; confirmation dialog requires typing DELETE).

### 4.7 Onboarding (3 steps)
1. **Welcome**: name (the account was already created on the sign-up screen).
2. **Set up your money** (mocked): currency quick-pick (GHS, USD, GBP, EUR, NGN, More) with a live format preview, detected time zone, week start, optional monthly budget.
3. **Reminders**: explain the one-a-day nudge, pick a time, enable push. On iPhone Safari (not installed) show "Add to Home Screen" steps first; reminders can be skipped.

### 4.8 Not mocked (built from the same components)
Sign up, log in, forgot/reset password, edit-expense sheet, category management, notification inbox, empty states. These are straightforward compositions of the components above.

---

## 5. Charts (per the data-viz rules)

- **Bars, not donuts or pies.** Category breakdowns are ranked horizontal bars with names and values, so colour never has to identify a category.
- **One hue** (`--chart`). Today/current period in `--primary`; partial periods striped; future days as grey 3px stubs.
- **Budget reference lines** are dashed `#B45309` and always labelled in a legend or caption.
- **Selective labels**: today and the highest value only. Every bar gets a hover/tap tooltip (Recharts `Tooltip`) with the exact amount and date.
- **Accessibility**: every chart has an `aria-label` summary plus a "View as table" toggle in Reports.
- No dual axes. No 3D. No gradients on data.

---

## 6. States

| State | Treatment |
|---|---|
| **Empty (new user)** | Hero shows "GHS 0.00, nothing logged yet today" with an "Add your first expense" button. Charts are replaced by a short line ("Your week will show here after your first expense"). Insights are hidden until there's enough data. |
| **No budget** | "Left this month" card becomes "Set a monthly budget" with one input. |
| **Loading** | Skeletons in the shape of each card. Numbers never flash a fake 0. |
| **Offline** | Slim banner: "You're offline. New expenses will sync when you're back." Add still works; edit/delete buttons disabled with a tooltip. |
| **Save failed** | Toast: "Couldn't save. We'll keep trying." with Retry; the expense stays in the queue, never lost. |
| **Form errors** | Inline under the field, in plain words ("Enter an amount above 0"). |

---

## 7. Notification copy

| Kind | Title | Body | Actions |
|---|---|---|---|
| Daily reminder | Nothing logged today | Got a minute? Tap to add today's spending. | Add expense · No spending today |
| Evening review | Today: GHS 86.50 | 4 expenses, 23% less than yesterday. | See today |
| Weekly summary | Last week: GHS 640.00 | 9% less than the week before. Food & Groceries was your top category. | See report |
| Monthly summary | October: GHS 3,310.00 | GHS 310.00 over your monthly budget. Here's where it went. | See report |
| Budget warning | Food & Groceries is at 80% | GHS 160.00 left for the rest of November. | See budget |
| Budget exceeded | Transportation is over budget | GHS 18.00 over for November. | See budget |

Every number is filled in from the database at send time. These are templates, not fixed text.

---

## 8. Accessibility checklist

- [ ] Text contrast ≥ 4.5:1 (all tokens above pass); graphics ≥ 3:1.
- [ ] Real `<button>`, `<a>`, `<input>` + `<label>`; switches use `role="switch"` + `aria-checked`.
- [ ] Icon-only buttons have `aria-label`; decorative icons `aria-hidden`.
- [ ] Focus rings visible (`--ring`), logical tab order, sheet/dialog traps focus and returns it on close.
- [ ] Amount changes announced via `aria-live="polite"` in quick add.
- [ ] Charts have text summaries and a table view.
- [ ] Works at 200% zoom and with `prefers-reduced-motion`.

---

## 9. Open design questions

| # | Question | My default |
|---|---|---|
| 1 | In-app keypad on phones, or the system number keyboard? | In-app keypad |
| 2 | Show "GHS" or "GH₵" for cedi amounts? | GHS |
| 3 | Brand name in the UI | **Decided: SpendWise Auto** (2026-11-20). The mockups still say "Pesewa"; the code reads the name from `src/config/brand.ts` |
