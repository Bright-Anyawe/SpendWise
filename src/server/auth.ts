import "server-only";
import { NEON_AUTH_SESSION_COOKIE_NAME } from "@neon/auth/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth, isNeonAuthConfigured } from "@/lib/auth/neon";
import type { Queryable } from "@/lib/db/queryable";
import { withUserTransaction } from "@/lib/db/user-transaction";
import type { Profile } from "@/lib/types/database";
import { ensureMyProfile, getMyProfile } from "./data/profile";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in person from the Neon Auth session. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // The session lives in cookies: reading them first marks this as request-time work (never prerendered).
  const cookieStore = await cookies();
  // Fresh clone without Neon Auth settings: treat everyone as signed out (sign-in shows a setup note).
  if (!isNeonAuthConfigured()) return null;
  // No session cookie means signed out: skip the round trip to Neon Auth (same check as its middleware).
  if (!cookieStore.getAll().some((c) => c.name.includes(NEON_AUTH_SESSION_COOKIE_NAME))) return null;
  const { data } = await getAuth().getSession();
  const user = data?.user;
  if (!user) return null;
  // Neon Auth user ids are UUIDs; app tables key on them.
  if (!UUID.test(user.id)) throw new Error("Neon Auth returned an account id that isn't a UUID.");
  return { id: user.id, email: user.email, name: user.name?.trim() || null };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");
  return user;
}

/** Runs fn in a transaction as the signed-in person (RLS applies). Redirects to sign-in if there's no session. */
export async function asCurrentUser<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
  const user = await requireUser();
  return withUserTransaction(user.id, fn);
}

/** The signed-in person's profile; created with their default categories on first visit. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  return withUserTransaction(user.id, async (db) => {
    const existing = await getMyProfile(db);
    if (existing) return existing;
    await ensureMyProfile(db, user.name);
    return getMyProfile(db);
  });
});

/** For app pages: signed in and finished onboarding, otherwise redirected. */
export async function requireOnboardedProfile(): Promise<{ user: CurrentUser; profile: Profile }> {
  const user = await requireUser();
  const profile = await getProfile();
  if (!profile) redirect("/auth/sign-in");
  if (!profile.onboarded_at) redirect("/onboarding");
  return { user, profile };
}
