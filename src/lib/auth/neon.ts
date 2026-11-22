import "server-only";
import { createNeonAuth } from "@neon/auth/next/server";

export type NeonAuth = ReturnType<typeof createNeonAuth>;

/** True once NEON_AUTH_BASE_URL and a 32+ character NEON_AUTH_COOKIE_SECRET are set. */
export function isNeonAuthConfigured(): boolean {
  return Boolean(process.env.NEON_AUTH_BASE_URL) && (process.env.NEON_AUTH_COOKIE_SECRET?.length ?? 0) >= 32;
}

let instance: NeonAuth | undefined;

/**
 * Neon Auth (Managed Better Auth) for server code: getSession, signIn.email, signUp.email, signOut,
 * requestPasswordReset, resetPassword, plus handler() and middleware().
 * Created on first use so builds and tests don't need the secrets.
 */
export function getAuth(): NeonAuth {
  if (instance) return instance;
  if (!isNeonAuthConfigured()) {
    throw new Error(
      "Neon Auth is not configured. Set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET (32+ characters) in .env.local — see docs/neon-setup.md.",
    );
  }
  instance = createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL as string,
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET as string },
  });
  return instance;
}
