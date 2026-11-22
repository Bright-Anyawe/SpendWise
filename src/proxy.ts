import { NextResponse, type NextRequest } from "next/server";
import { getAuth, isNeonAuthConfigured } from "@/lib/auth/neon";

type Middleware = ReturnType<ReturnType<typeof getAuth>["middleware"]>;
let middleware: Middleware | undefined;

/**
 * Neon Auth's middleware: refreshes the session and sends signed-out visitors to /auth/sign-in.
 * Its built-in public routes already cover /api/auth and /auth/sign-in, sign-up, forgot-password,
 * reset-password and error. Created on first request so the build doesn't need the secrets.
 */
export async function proxy(request: NextRequest) {
  // Not configured yet (fresh clone): let pages render their own setup message.
  if (!isNeonAuthConfigured()) return NextResponse.next();
  // /offline is cached by the service worker and must load without a session.
  // These API routes check access themselves and must answer with JSON, not a sign-in redirect:
  // the scheduler has no session (it sends CRON_SECRET), and offline sync needs a clear 401.
  middleware ??= getAuth().middleware({
    loginUrl: "/auth/sign-in",
    publicRoutes: ["/offline", "/api/cron", "/api/expenses/sync"],
  });
  return middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
