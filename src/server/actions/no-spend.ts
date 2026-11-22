"use server";

import { revalidatePath } from "next/cache";
import { withUserTransaction } from "@/lib/db/user-transaction";
import { isoDateSchema } from "@/schemas/common";
import { type ActionResult, fail, ok } from "../action-result";
import { todayInTimeZone } from "@/lib/dates";
import { requireOnboardedProfile, requireUser } from "../auth";
import * as data from "../data/no-spend";

/** "No spending today": silences that day's reminder and counts toward the logging streak. */
export async function markNoSpendDay(day: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isoDateSchema.safeParse(day).success) return fail("Choose a valid date.");
  try {
    await withUserTransaction(user.id, (db) => data.markNoSpendDay(db, day));
  } catch {
    return fail("We couldn't save that. Please try again.");
  }
  revalidatePath("/", "layout");
  return ok(undefined);
}

/** From the evening reminder's "No spending today" button: today in the person's own time zone. */
export async function markNoSpendToday(): Promise<ActionResult> {
  const { profile } = await requireOnboardedProfile();
  return markNoSpendDay(todayInTimeZone(profile.timezone));
}

export async function unmarkNoSpendDay(day: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isoDateSchema.safeParse(day).success) return fail("Choose a valid date.");
  try {
    await withUserTransaction(user.id, (db) => data.unmarkNoSpendDay(db, day));
  } catch {
    return fail("We couldn't save that. Please try again.");
  }
  revalidatePath("/", "layout");
  return ok(undefined);
}
