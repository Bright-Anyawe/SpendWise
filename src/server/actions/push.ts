"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { withOwnerTransaction } from "@/lib/db/owner-transaction";
import { withUserTransaction } from "@/lib/db/user-transaction";
import { type ActionResult, fail, ok } from "../action-result";
import { requireUser } from "../auth";
import { claimPushSubscription, mySubscription, recordPushResults, removeMySubscription } from "../data/push";
import { isPushConfigured, sendPush } from "../push/send";

// The shape of PushSubscription.toJSON() in the browser.
const subscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

const endpointSchema = z.url({ protocol: /^https$/ }).max(1000);

/** Turns notifications on for this device. */
export async function savePushSubscription(subscription: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!isPushConfigured()) return fail("Notifications aren’t set up on this server yet.");
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return fail("Your browser sent a subscription we couldn’t use. Try turning notifications on again.");

  const userAgent = (await headers()).get("user-agent");
  try {
    await withOwnerTransaction((db) =>
      claimPushSubscription(db, user.id, {
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        userAgent,
      }),
    );
  } catch {
    return fail("We couldn’t turn notifications on. Please try again.");
  }
  return ok(undefined);
}

/** Whether this device's browser subscription is on the signed-in person's account (not someone who used it before). */
export async function isThisDeviceSubscribed(endpoint: unknown): Promise<boolean> {
  const user = await requireUser();
  const parsed = endpointSchema.safeParse(endpoint);
  if (!parsed.success) return false;
  return (await withUserTransaction(user.id, (db) => mySubscription(db, parsed.data))) !== null;
}

/** Turns notifications off for this device. */
export async function removePushSubscription(endpoint: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = endpointSchema.safeParse(endpoint);
  if (!parsed.success) return ok(undefined);
  try {
    await withUserTransaction(user.id, (db) => removeMySubscription(db, parsed.data));
  } catch {
    return fail("We couldn’t turn notifications off. Please try again.");
  }
  return ok(undefined);
}

/** Sends a test notification to this device only. */
export async function sendTestPush(endpoint: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = endpointSchema.safeParse(endpoint);
  if (!parsed.success) return fail("Turn notifications on for this device first.");

  const subscription = await withUserTransaction(user.id, (db) => mySubscription(db, parsed.data));
  if (!subscription) return fail("Turn notifications on for this device first.");

  const results = await sendPush([subscription], {
    title: "Notifications are on",
    body: "This is how SpendWise reminders will look on this device.",
    url: "/settings",
    tag: "test",
  });
  await withOwnerTransaction((db) => recordPushResults(db, results)).catch(() => undefined);

  if (results.gone.length) return fail("This device’s notification subscription has expired. Turn notifications off and on again.");
  if (results.failed.length) return fail("We couldn’t reach this device’s push service. Try again in a moment.");
  return ok(undefined);
}
