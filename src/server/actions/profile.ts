"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withUserTransaction } from "@/lib/db/user-transaction";
import { onboardingSchema } from "@/schemas/profile";
import { requireUser } from "../auth";
import { type ActionResult, fail, formDataToObject, fromZodError } from "../action-result";
import { ensureMyProfile, saveOnboarding } from "../data/profile";

export async function completeOnboarding(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const raw = formDataToObject(formData);
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error, raw);

  try {
    await withUserTransaction(user.id, async (db) => {
      await ensureMyProfile(db, user.name);
      await saveOnboarding(db, parsed.data);
    });
  } catch {
    return fail("We couldn't save your settings. Please try again.", undefined, raw);
  }

  revalidatePath("/", "layout");
  redirect("/");
}
