/** The error shape Neon Auth (Better Auth) returns from its server methods. */
export interface AuthError {
  code?: string;
  status?: number;
  message?: string;
}

export const UNTRUSTED_SITE_MESSAGE = "Sign-in isn’t available on this web address yet. Please try again later.";

/**
 * For errors the form can't explain to the person: logs the reason for whoever runs the site
 * (it shows in the Vercel function logs) and returns what to show instead. Never logs the email.
 */
export function unexpectedAuthError(action: string, error: AuthError, fallback: string): string {
  if (error.code === "INVALID_ORIGIN") {
    console.error(
      `[auth] ${action} refused: this site's address is not a trusted domain in Neon Auth. Add it in the Neon Console → Auth → Domains.`,
    );
    return UNTRUSTED_SITE_MESSAGE;
  }
  console.error(`[auth] ${action} failed: ${error.code || "no code"}${error.status ? ` (HTTP ${error.status})` : ""}`);
  return fallback;
}
