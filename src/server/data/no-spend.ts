import type { Queryable } from "@/lib/db/queryable";

/** "No spending today": silences that day's reminder and counts toward the logging streak. */
export async function markNoSpendDay(db: Queryable, day: string): Promise<void> {
  await db.query("insert into public.no_spend_days (day) values ($1) on conflict (user_id, day) do nothing", [day]);
}

export async function unmarkNoSpendDay(db: Queryable, day: string): Promise<void> {
  await db.query("delete from public.no_spend_days where day = $1", [day]);
}
