// Runs the reminder job once, the way the scheduler will: POST /api/cron/notify with the cron secret.
//   npm run notify:once                      → the app at NEXT_PUBLIC_SITE_URL (e.g. http://localhost:3000)
//   npm run notify:once -- https://my.app    → another deployment
// Reads CRON_SECRET and NEXT_PUBLIC_SITE_URL from .env.local (via node --env-file). Never prints the secret.

const base = (process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("CRON_SECRET is not set. Add it to .env.local (see .env.example).");
  process.exit(1);
}

const response = await fetch(`${base}/api/cron/notify`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});
const body = await response.text();
console.log(`${response.status} ${base}/api/cron/notify`);
console.log(body);
process.exit(response.ok ? 0 : 1);
