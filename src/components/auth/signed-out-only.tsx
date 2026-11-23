import { redirect } from "next/navigation";
import { isNeonAuthConfigured } from "@/lib/auth/neon";
import { AuthUnavailableError, getCurrentUser } from "@/server/auth";

/**
 * For sign-in pages (render inside <Suspense>): sends signed-in people home, and explains a
 * missing configuration instead of failing on a fresh clone.
 */
export async function SignedOutOnly() {
  // Reads the session cookies first, so this always runs per request and is never baked into the static page.
  // If Neon Auth can't be reached right now, show the form rather than failing the sign-in page.
  const user = await getCurrentUser().catch((error: unknown) => {
    if (error instanceof AuthUnavailableError) return null;
    throw error;
  });
  if (user) redirect("/");
  if (!isNeonAuthConfigured()) {
    return (
      <p role="alert" className="rounded-md bg-warning-bg px-4 py-3 text-sm leading-5 text-warning">
        Sign-in isn’t set up yet. Add the Neon Auth settings to .env.local (see docs/neon-setup.md).
      </p>
    );
  }
  return null;
}
