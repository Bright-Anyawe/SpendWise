# Neon setup (database + sign-in)

SpendWise Auto runs on **Neon Postgres** with **Neon Auth** (Managed Better Auth) for accounts. This guide connects a fresh clone to Neon and then to Vercel. Allow about 20 minutes.

> **You don't need Neon to run the tests.** `npm test` runs every migration in an in-memory Postgres (PGlite), including the Row Level Security checks and the app's own queries.

---

## 1. Create a dedicated Neon project

In the [Neon Console](https://console.neon.tech) → **New project**:

- **Name:** `SpendWise Auto`. Neon Auth uses the project name as the app name in its emails.
- **Postgres version:** 17.
- **Cloud and region:** **AWS**, in the region closest to your users. For Ghana, *AWS Europe (London)* or *AWS Europe (Frankfurt)* are the nearest. Neon Auth only works on AWS projects.
- Don't turn on **IP Allow** or **Private Networking**: Neon Auth can't be enabled on projects that use them.

**Use a new project, not an existing one such as "Optimize-tasks".** That keeps SpendWise Auto's data, users and database branches separate from the other app.

## 2. Turn on Neon Auth

In the new project: **Auth** → **Enable Neon Auth**. Then, in its settings:

- **Email and password:** on.
- **Verify email at signup:** leave **off** for now. Neon's shared email sender can only send *codes*, not links. Turn it on after step 7 if you want verification.
- **Allow localhost:** on while you develop. Turn it off in production.
- Copy the **Auth URL** (it ends in `/auth`). This is `NEON_AUTH_BASE_URL`.

## 3. Fill in `.env.local`

```powershell
Copy-Item .env.example .env.local
```

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Project dashboard → **Connect** → connection string with **Connection pooling on** (the host contains `-pooler`) |
| `DATABASE_URL_UNPOOLED` | Same dialog with **Connection pooling off** (no `-pooler`). Only used for migrations. |

In both connection strings, change `sslmode=require` to **`sslmode=verify-full`**. That keeps full certificate checking when the `pg` driver's next major version weakens what `require` means. It also silences the security warning `pg` prints today.
| `NEON_AUTH_BASE_URL` | The Auth URL from step 2 |
| `NEON_AUTH_COOKIE_SECRET` | Any 32+ character random string. Generate one with the command below. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` for development |

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**The connection strings contain your database password, and the cookie secret signs sign-in sessions.** Keep both in `.env.local` (git ignores it) and in Vercel's environment settings. Never commit them or prefix them with `NEXT_PUBLIC_`.

## 4. Create the tables

```powershell
npm run db:migrate
```

This applies `db/migrations/*.sql` in order over the direct connection and records each file in `app.schema_migrations`. Running it again only applies new files. It creates:

- the tables, constraints and triggers;
- the `spendwise_user` role the app switches into for every signed-in request, plus Row Level Security so each person only sees their own rows;
- the spending and budget calculation functions.

**Check it worked** in the Neon **SQL Editor**. Every table should show `rls_enabled = true`.

```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
order by 1;
```

## 5. Run the app

```powershell
npm install
```

```powershell
npm run dev
```

Open http://localhost:3000. You'll land on **Sign in**:

1. Choose **Create an account**.
2. You're taken to onboarding: currency, time zone and an optional monthly budget.
3. The home page shows today/week/month totals computed by the database.

Your account appears in Neon under the `neon_auth` schema. Your profile and its 12 default categories are created in `public` on your first visit.

## 6. Deploy on Vercel

On the **New Project** screen (importing `Bright-Anyawe/SpendWise`):

1. **Preset, build command and region come from `vercel.json`:** Next.js, `npm run db:migrate && npm run build` (each deployment applies any new migrations first, and a failing migration stops the deploy), and functions in Frankfurt (`fra1`), next to the database. If the screen still shows "Other", choose Next.js; `vercel.json` wins either way.
2. **Environment Variables** (all environments). The quickest way: copy the contents of your `.env.local` and paste them into the first Key field; Vercel splits them into separate variables. Then change two values:
   - `NEXT_PUBLIC_SITE_URL` → your production URL, e.g. `https://spendwise-auto.vercel.app`
   - `VAPID_SUBJECT` → a real contact of yours, e.g. `mailto:you@yourdomain.com` (push services use it if something goes wrong; Apple may reject pushes with a placeholder)

   The full list: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.
3. Deploy only after the code is committed and pushed to GitHub.

**If you use the Neon ↔ Vercel integration,** connect it to the new **SpendWise Auto** project. It fills in `DATABASE_URL` / `DATABASE_URL_UNPOOLED` for you, and can give each preview deployment its own database branch. Each branch also has its own Auth URL, so previews need that branch's `NEON_AUTH_BASE_URL`; production uses the main branch's.

**Trusted domains.** In Neon → **Auth** → settings, add every address the app is served from, with the scheme and no trailing slash:

- `https://spendwise-auto.vercel.app` (or your custom domain)
- any preview URLs you want sign-in to work on

Password-reset links only return to trusted domains.

## 7. Before real users

- **Custom email (SMTP):** Neon → Auth → settings → email provider. The shared sender (`auth@mail.myneon.app`) is rate-limited and for development only. Any provider works (Resend, Postmark, Amazon SES, Brevo); use a sender on a domain you own.
- **Turn off "Allow localhost"** on the production branch.
- **Email verification:** turn it on once custom SMTP works, if you want it.

## 8. GitHub integration

The GitHub integration in your screenshot was added from the **Optimize-tasks** project, and it stored `NEON_API_KEY` and `NEON_PROJECT_ID` as secrets in the SpendWise repository.

- Remove those two secrets (GitHub → repository **Settings → Secrets and variables → Actions**), or replace them by connecting the integration from the **SpendWise Auto** project instead.
- A pull-request workflow (a database branch per PR, with migrations run on it) is planned for Phase 6.

---

## How the pieces fit

| In this repo | Configured in Neon / Vercel |
|---|---|
| Tables, constraints, triggers, RLS, calculations (`db/migrations`) | The Neon project, Neon Auth, connection strings |
| Migration runner (`npm run db:migrate`) | Auth settings, trusted domains, custom SMTP |
| Sign-up, sign-in, password reset, onboarding (`src/app/auth`, `src/server/actions/auth.ts`) | Vercel environment variables and build command |
| Session handling and route protection (`src/proxy.ts`, Neon Auth middleware) | (Phase 5) VAPID keys, `CRON_SECRET`, the scheduler |
