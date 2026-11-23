# SpendWise Auto

A mobile-first personal expense tracker (PWA): log an expense in seconds, see where your money goes today, this week and this month, and stay inside your budgets.

The product name lives in `src/config/brand.ts`.

## Status

| Phase | State |
|---|---|
| 1. Product plan & architecture | Done ([docs/phase-1-product-plan.md](docs/phase-1-product-plan.md)) |
| 2. UI/UX design system & mockups | Done ([docs/phase-2-design-system.md](docs/phase-2-design-system.md)) |
| 3. Database & backend | Done, on Neon: schema, RLS, calculations, Neon Auth, server actions ([plan](docs/superpowers/plans/2026-11-19-phase-3-database-backend.md)) |
| 4. Frontend (dashboard, quick add, transactions, budgets, reports, settings) | Done ([plan](docs/superpowers/plans/2026-11-20-phase-4-frontend.md)) |
| 5. PWA & notifications | Done: installable app, offline add + sync, push, reminders, summaries, budget alerts ([plan](docs/superpowers/plans/2026-11-22-phase-5-pwa-notifications.md)). Reminders run every 15 minutes from a Neon Function schedule (`neon.ts`). |
| 6. Testing & deployment | Planned |

## Stack

Next.js 16 (App Router, Server Actions, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Zod · **Neon Postgres** (`pg` + Vercel pool) · **Neon Auth** (Managed Better Auth) · Vitest + PGlite.

## Getting started

1. `npm install`
2. Set up Neon and `.env.local`: **[docs/neon-setup.md](docs/neon-setup.md)**
3. `npm run db:migrate`
4. `npm run dev` → http://localhost:3000

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run db:migrate` | Applies new files in `db/migrations` to Neon (direct connection) |
| `npm test` | Unit tests + database tests (migrations and the app's SQL run in an in-memory Postgres, no Neon needed) |
| `npm run typecheck` | Generates route types, then runs the TypeScript checker |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm start` | Serves the production build (the service worker, offline mode and push only run here, not in `npm run dev`) |
| `npm run neon:deploy` | Deploys the reminder scheduler (Neon Function + 15-minute trigger from `neon.ts`); needs the Neon CLI signed in and `CRON_SECRET` in `.env.local` |
| `npm run notify:once` | Runs the reminder job once, like the scheduler will (uses `CRON_SECRET` from `.env.local`; pass another URL after `--`) |

## Where things live

```
db/
  migrations/      SQL: schema → RLS → functions (applied in order by npm run db:migrate)
  tests/           Database tests (PGlite): rules, calculations, and the app's data functions
scripts/           Migration runner
src/
  app/             Routes: auth/* (sign-in pages), onboarding, (app) signed-in pages, api/auth (Neon Auth proxy)
  components/      UI (shadcn primitives in components/ui)
  config/          Brand, currencies, payment methods
  lib/             Pure helpers (money, dates, calc, search), Neon Auth, database pool, row types
  schemas/         Zod schemas shared by forms and server actions
  server/
    auth.ts        Session → signed-in person, profile, per-request database transaction
    data/          All SQL the app runs (tested against PGlite)
    actions/       Server Actions (validated writes)
    queries/       Read entry points for Server Components
  proxy.ts         Neon Auth middleware: session refresh + route protection
docs/              Product plan, design system, setup guide, implementation plans
```

## Ground rules

- Every number shown to a person is computed in the database from their own records. Savings counts as "set aside", not spending.
- Days, weeks and months follow the person's own time zone and week start.
- Each request runs as the restricted `spendwise_user` role with the person's id set, so Row Level Security limits every query to their own rows (tested in `db/tests/rls.test.ts`).
- Connection strings and `NEON_AUTH_COOKIE_SECRET` stay in `.env.local` and Vercel settings, never in code or `NEXT_PUBLIC_` variables.
