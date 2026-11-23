import { defineConfig } from "@neon/config/v1";

// Neon-side infrastructure for SpendWise Auto: the scheduler for reminders and summaries.
// Every 15 minutes a Neon Function Trigger calls the `reminders` function, which asks the app to run
// its reminder job (POST /api/cron/notify with CRON_SECRET). The job decides what's due in each
// person's own time zone, so running it late or twice never sends anything twice.
//
// Deploy or update:  npm run neon:deploy   (reads CRON_SECRET from .env.local; it must match Vercel's)
export default defineConfig({
  functions: {
    reminders: {
      name: "Reminder scheduler",
      source: "neon/reminders.ts",
      env: {
        CRON_SECRET: { value: process.env.CRON_SECRET, required: true },
        APP_URL: process.env.REMINDERS_APP_URL ?? "https://spendwiseauto.vercel.app",
      },
    },
  },
  triggers: {
    "reminders-every-15-min": {
      type: "schedule",
      function: "reminders",
      cron: "*/15 * * * *",
    },
  },
});
