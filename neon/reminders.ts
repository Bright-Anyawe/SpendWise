import { parseTriggerInvocation } from "@neon/functions/triggers";

/**
 * Neon Function (see neon.ts). Runs on the 15-minute schedule trigger and asks the app to send
 * whatever reminders and summaries are due. Only Neon's trigger can call it: the Functions proxy
 * strips client-sent x-neon-* headers, so a valid invocation id can't be forged from outside.
 */
const reminders = {
  async fetch(request: Request): Promise<Response> {
    const parsed = await parseTriggerInvocation(request);
    if (!parsed.ok) return new Response(parsed.error, { status: parsed.error === "invalid_body" ? 400 : 401 });

    const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
    try {
      const response = await fetch(`${appUrl}/api/cron/notify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        signal: AbortSignal.timeout(120_000),
      });
      const body = await response.text();
      console.log(`[reminders] ${parsed.invocation.data.scheduledAt}: app answered ${response.status} ${body.slice(0, 300)}`);
      return new Response(body, { status: response.ok ? 200 : 502, headers: { "Content-Type": "application/json" } });
    } catch (error) {
      console.error(`[reminders] ${parsed.invocation.data.scheduledAt}: couldn't reach the app: ${error instanceof Error ? error.message : String(error)}`);
      return new Response("The app couldn't be reached.", { status: 502 });
    }
  },
};

export default reminders;
