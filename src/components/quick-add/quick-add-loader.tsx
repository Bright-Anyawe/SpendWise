import { getProfile } from "@/server/auth";
import { getQuickAddOptions } from "@/server/queries";
import { QuickAddSheet } from "./quick-add-sheet";

/** Loads what quick add needs (categories by use, currency, time zone) for the signed-in person. */
export async function QuickAddLoader() {
  const profile = await getProfile();
  if (!profile?.onboarded_at) return null;
  const options = await getQuickAddOptions();
  return (
    <QuickAddSheet
      categories={options.categories}
      lastPaymentMethod={options.lastPaymentMethod}
      currency={profile.currency}
      timezone={profile.timezone}
    />
  );
}
