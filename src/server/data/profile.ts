import { one, type Queryable } from "@/lib/db/queryable";
import type { Profile } from "@/lib/types/database";
import type { OnboardingInput } from "@/schemas/profile";

/** The signed-in person's profile, or null before their first visit has set it up. */
export function getMyProfile(db: Queryable): Promise<Profile | null> {
  return one<Profile>(db, "select * from public.profiles where id = (select app.current_user_id())");
}

/** Creates profile, preferences and default categories on first sign-in. Does nothing afterwards. */
export async function ensureMyProfile(db: Queryable, displayName: string | null): Promise<void> {
  await db.query("select app.ensure_profile($1)", [displayName]);
}

/** Saves the onboarding answers and creates (or updates) the overall monthly budget if one was given. */
export async function saveOnboarding(db: Queryable, input: OnboardingInput): Promise<void> {
  await db.query(
    `update public.profiles
        set display_name = coalesce($1, display_name),
            currency = $2,
            timezone = $3,
            week_starts_on = $4,
            onboarded_at = coalesce(onboarded_at, now())
      where id = (select app.current_user_id())`,
    [input.displayName ?? null, input.currency, input.timezone, input.weekStartsOn],
  );

  if (input.monthlyBudget) {
    const updated = await db.query(
      "update public.budgets set amount = $1 where period = 'monthly' and category_id is null returning id",
      [input.monthlyBudget],
    );
    if (updated.rows.length === 0) {
      await db.query("insert into public.budgets (period, category_id, amount) values ('monthly', null, $1)", [input.monthlyBudget]);
    }
  }
}
