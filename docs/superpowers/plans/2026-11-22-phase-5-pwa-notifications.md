# Phase 5: PWA, Offline & Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app installs to the home screen, works offline (adding expenses queues and syncs), and sends push reminders, evening reviews, weekly/monthly summaries and budget alerts without repeats.

**Architecture:**
- **Service worker:** a hand-written `public/sw.js` (as in the Next.js 16 PWA guide) caches static assets, serves an offline page, and handles push, notification clicks and background sync.
- **Offline queue:** quick add always generates the expense id on the device; if saving fails because there's no connection, the expense goes into an IndexedDB queue that `POST /api/expenses/sync` drains (insert is idempotent by id).
- **Notifications:** inserted with a unique dedupe key, so a notification is created once and pushed once.
- **Reminder job:** `runDueNotifications(now)` runs as the database owner, sets `app.user_id` per person to reuse the spending functions, and is exposed at `POST /api/cron/notify` behind `CRON_SECRET`. A Neon Function cron trigger will call it every 15 minutes once the app is deployed (Phase 6).

**Tech Stack:** Next.js 16 (`app/manifest.ts`, `after()`), `web-push` 4.0.0 (VAPID), IndexedDB, Vitest + PGlite.

**Spec:** `docs/phase-1-product-plan.md` §6.4–6.5 (notifications, offline), `docs/phase-2-design-system.md` §6 (states) and §7 (notification copy).

## Global Constraints

- Never more than **3 pushes per person per local day**; never a reminder and a review on the same evening (dedupe key `evening:<date>` is shared by both).
- **Times are local:**
  - Daily reminder or review: due from the person's `reminder_time` until 2 hours after it.
  - Weekly summary: the first day of their week, 09:00–12:00.
  - Monthly summary: the 1st, 09:00–12:00.
  - Because of the dedupe keys, a late or repeated run can't send anything twice.
- A "no spending today" mark silences that day's reminder.
- Push subscriptions that return 404/410 are deleted.
- The VAPID private key, `CRON_SECRET` and the owner connection are server-only.
- Offline: only **adding** works offline (Phase 1 §3.4). Queued expenses show as "waiting to sync" and are never dropped silently. Invalid ones are reported, not retried forever.
- Notification copy follows Phase 2 §7, with numbers from the database.

## Review Focus

1. **Scheduler late or run twice** → one notification, one push → `runs twice in the same window` test.
2. **Time zone and day boundary**: a person in `Pacific/Auckland` gets their 20:00 reminder at their 20:00, not UTC's → `respects the person's time zone` test.
3. **Offline retry after the server already saved it** → no duplicate → sync route uses idempotent `insertExpense` (Phase 3 test) plus `drains the queue and keeps failures` test.
4. **Same browser, second account** subscribes → the endpoint moves to the new account → `claimPushSubscription` test.
5. **Push service says gone (410)** → subscription removed, job continues → `removes expired subscriptions` test.

---

### Task 1: Installable app + offline page
`src/app/manifest.ts`, `public/icons/*` (192, 512, maskable, apple-touch), `public/sw.js`, `src/app/offline/page.tsx`, `src/components/pwa/register-sw.tsx`, root layout metadata (apple web app, theme colour).
- [ ] Manifest: name "SpendWise Auto", short_name "SpendWise", start_url "/", display "standalone", theme `#065f46`, background `#f7f9f8`, icons.
- [ ] Service worker: precache `/offline` and icons; cache-first for `/_next/static/*` and icons; network-first for navigations falling back to the cached page, then `/offline`; message `clear-caches` on sign-out.

### Task 2: Offline expense queue
`src/lib/offline/queue.ts` (+test with in-memory store), `src/lib/offline/idb-store.ts`, `src/app/api/expenses/sync/route.ts`, `src/components/pwa/sync-status.tsx`, quick-add changes.
- **Produces:** `createQueue(store)` → `{ add(item), all(), remove(ids), count() }`; `drainQueue(queue, send)` → `{ synced, failed, remaining }`.
- [ ] Tests: `drains the queue and keeps failures`; network failure leaves items queued; invalid items are dropped and reported.
- [ ] Quick add generates the id; on a network failure it queues the expense and shows "Saved on this device. It'll sync when you're back online." A status bar shows "You're offline" or "N expenses waiting to sync". The queue syncs when the device comes back online, when the app opens, and on Background Sync.

### Task 3: Push subscriptions
`src/lib/db/owner-transaction.ts`, `src/server/data/push.ts` (+PGlite test), `src/server/push/send.ts`, `src/server/actions/push.ts`, `src/components/settings/push-settings.tsx`, VAPID keys in `.env.local`.
- **Produces:** `claimPushSubscription(ownerDb, userId, sub)`, `subscriptionsFor(ownerDb, userId)`, `sendPush(subs, payload) → { sent, gone }`.
- [ ] Tests: `claimPushSubscription` moves an endpoint between accounts; a re-subscribe updates keys.
- [ ] Settings → "Notifications on this device": turn on (permission + subscribe), turn off, send a test. On iPhone (not installed), show "Add to Home Screen" steps first.

### Task 4: Reminders, summaries and budget alerts
`db/migrations/20261122000004_notifications.sql` (`app.due_notifications(now)`), `src/server/notifications/{copy,run-due,budget-alerts}.ts` (+tests), `src/app/api/cron/notify/route.ts`, `src/app/(app)/notifications/page.tsx`, bell with unread count, `scripts/notify-once.mjs`.
- [ ] Tests: `respects the person's time zone`; `runs twice in the same window` → one row, one push; `no-spend day silences the reminder`; `evening review instead of reminder when something was logged`; `weekly summary on the week's first day only`; `removes expired subscriptions`; `caps pushes at 3 a day`; budget alert once per budget per period, and only when alerts are on.
- [ ] Cron route: `POST` with `Authorization: Bearer $CRON_SECRET` only; returns counts.

### Task 5: Verify
- [ ] `npm run lint && npm run typecheck && npm test && npm run build`. In the browser: the manifest loads, the service worker registers, the offline page renders, and the cron route returns 401 without the secret.
