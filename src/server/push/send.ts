import "server-only";
import webpush from "web-push";

/** What public/sw.js shows. `actions` become notification buttons ("add", "no-spend"). */
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  /** Same tag replaces an older notification on the device instead of stacking. */
  tag?: string;
  actions?: { action: "add" | "no-spend"; title: string }[];
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushResults {
  delivered: string[];
  failed: string[];
  /** The push service says these no longer exist (404/410): delete them. */
  gone: string[];
}

let configured: boolean | undefined;

/** True when the VAPID keys are set (see .env.example). Without them nothing is pushed. */
export function isPushConfigured(): boolean {
  if (configured !== undefined) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  configured = Boolean(publicKey && privateKey && subject);
  if (configured) webpush.setVapidDetails(subject!, publicKey!, privateKey!);
  return configured;
}

function statusOf(error: unknown): number | undefined {
  return error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number"
    ? error.statusCode
    : undefined;
}

/** Sends one payload to each device. Never throws: every endpoint ends up delivered, failed or gone. */
export async function sendPush(targets: PushTarget[], payload: PushPayload): Promise<PushResults> {
  const results: PushResults = { delivered: [], failed: [], gone: [] };
  if (targets.length === 0) return results;
  if (!isPushConfigured()) {
    results.failed.push(...targets.map((t) => t.endpoint));
    return results;
  }

  const body = JSON.stringify(payload);
  await Promise.all(
    targets.map(async (target) => {
      try {
        await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, body, {
          TTL: 4 * 60 * 60, // a reminder older than 4 hours isn't worth showing
          urgency: "normal",
          timeout: 10_000,
        });
        results.delivered.push(target.endpoint);
      } catch (error) {
        const status = statusOf(error);
        (status === 404 || status === 410 ? results.gone : results.failed).push(target.endpoint);
      }
    }),
  );
  return results;
}
