import { afterEach, describe, expect, it, vi } from "vitest";
import { UNTRUSTED_SITE_MESSAGE, unexpectedAuthError } from "./auth-errors";

describe("unexpectedAuthError", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  afterEach(() => log.mockClear());

  it("explains an untrusted site address and says where to fix it", () => {
    expect(unexpectedAuthError("sign-up", { code: "INVALID_ORIGIN", status: 403 }, "fallback")).toBe(UNTRUSTED_SITE_MESSAGE);
    expect(log.mock.calls[0][0]).toContain("trusted domain in Neon Auth");
  });

  it("logs the code and status of anything else and shows the fallback", () => {
    expect(unexpectedAuthError("sign-in", { code: "TOO_MANY_REQUESTS", status: 429 }, "Try again.")).toBe("Try again.");
    expect(log).toHaveBeenCalledWith("[auth] sign-in failed: TOO_MANY_REQUESTS (HTTP 429)");
  });
});
