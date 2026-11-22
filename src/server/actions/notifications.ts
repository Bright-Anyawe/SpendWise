"use server";

import { revalidatePath } from "next/cache";
import { withUserTransaction } from "@/lib/db/user-transaction";
import { type ActionResult, fail, ok } from "../action-result";
import { requireUser } from "../auth";
import { markAllNotificationsRead } from "../data/notifications";

/** Called when the inbox has been seen. */
export async function markNotificationsRead(): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const changed = await withUserTransaction(user.id, markAllNotificationsRead);
    if (changed > 0) revalidatePath("/", "layout");
  } catch {
    return fail("We couldn’t update your notifications.");
  }
  return ok(undefined);
}
