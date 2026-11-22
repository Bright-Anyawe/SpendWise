import { timingSafeEqual } from "node:crypto";
import { runDueNotifications } from "@/server/notifications/run-due";
import { liveNotifyDeps } from "@/server/notifications/live";

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * The reminder job. Called every 15 minutes by the scheduler with `Authorization: Bearer $CRON_SECRET`.
 * Sends whatever is due in each person's own time zone; safe to call late or more than once.
 */
export async function POST(request: Request) {
  if (!authorised(request)) return Response.json({ error: "Not allowed." }, { status: 401 });
  const counts = await runDueNotifications(new Date(), liveNotifyDeps);
  return Response.json(counts);
}
