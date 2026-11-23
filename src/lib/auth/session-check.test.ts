import { describe, expect, it } from "vitest";
import { hasSessionCookie, isLoginRedirect, sessionCheckOutcome } from "./session-check";

const user = { id: "u", email: "a@example.com", name: "Ama" };

describe("sessionCheckOutcome", () => {
  it("signed in when Neon Auth returns a user", () => {
    expect(sessionCheckOutcome({ data: { user }, error: null })).toBe("signed-in");
  });

  it("signed out only when Neon Auth says there's no valid session", () => {
    expect(sessionCheckOutcome({ data: null, error: null })).toBe("signed-out");
    expect(sessionCheckOutcome({ data: { user: null }, error: null })).toBe("signed-out");
    expect(sessionCheckOutcome({ data: null, error: { status: 401, code: "UNAUTHORIZED" } })).toBe("signed-out");
  });

  it("unavailable (not signed out) when Neon Auth can't be reached or fails", () => {
    expect(sessionCheckOutcome({ data: null, error: { status: 502, code: "NETWORK_TIMEOUT" } })).toBe("unavailable");
    expect(sessionCheckOutcome({ data: null, error: { status: 503 } })).toBe("unavailable");
    expect(sessionCheckOutcome({ data: null, error: { status: 429, code: "TOO_MANY_REQUESTS" } })).toBe("unavailable");
    expect(sessionCheckOutcome({ data: null, error: { code: "NETWORK_RESET" } })).toBe("unavailable");
  });
});

describe("isLoginRedirect", () => {
  const redirect = (location: string, status = 307) => new Response(null, { status, headers: { location } });

  it("spots the proxy sending someone to sign-in", () => {
    expect(isLoginRedirect(redirect("https://app.test/auth/sign-in?next=%2Fbudgets"), "https://app.test/budgets")).toBe(true);
    expect(isLoginRedirect(redirect("/auth/sign-in"), "https://app.test/")).toBe(true);
  });

  it("ignores other responses", () => {
    expect(isLoginRedirect(new Response("ok"), "https://app.test/")).toBe(false);
    expect(isLoginRedirect(redirect("https://app.test/onboarding"), "https://app.test/")).toBe(false);
    expect(isLoginRedirect(redirect("https://elsewhere.test/auth/sign-in"), "https://app.test/")).toBe(false);
  });
});

describe("hasSessionCookie", () => {
  it("finds the Neon Auth session token cookie", () => {
    expect(hasSessionCookie("theme=light; __Secure-neon-auth.session_token=abc")).toBe(true);
    expect(hasSessionCookie("__Secure-neon-auth.local.session_data=xyz")).toBe(false);
    expect(hasSessionCookie(null)).toBe(false);
  });
});
