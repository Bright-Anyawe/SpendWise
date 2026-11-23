import { NEON_AUTH_SESSION_COOKIE_NAME } from "@neon/auth/server";

export type SessionCheckOutcome = "signed-in" | "signed-out" | "unavailable";

interface SessionResult {
  data: { user?: unknown } | null;
  error: { status?: number; code?: string } | null;
}

/**
 * Reads a Neon Auth getSession() result. Only a clear "no valid session" counts as signed out;
 * a network failure, timeout or server error is "unavailable", so a hiccup never signs anyone out.
 */
export function sessionCheckOutcome({ data, error }: SessionResult): SessionCheckOutcome {
  if (!error) return data?.user ? "signed-in" : "signed-out";
  if (error.status === 401 || error.status === 403) return "signed-out";
  return "unavailable";
}

/** Whether a proxy response sends the visitor to this site's sign-in page. */
export function isLoginRedirect(response: Response, requestUrl: string, loginPath = "/auth/sign-in"): boolean {
  if (response.status < 300 || response.status >= 400) return false;
  const location = response.headers.get("location");
  if (!location) return false;
  const target = new URL(location, requestUrl);
  return target.origin === new URL(requestUrl).origin && target.pathname === loginPath;
}

/** Whether the request carries a Neon Auth session token (the person signed in on this device). */
export function hasSessionCookie(cookieHeader: string | null): boolean {
  return Boolean(cookieHeader?.includes(NEON_AUTH_SESSION_COOKIE_NAME));
}
