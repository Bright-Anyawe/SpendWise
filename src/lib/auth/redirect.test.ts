import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("keeps same-site relative paths", () => {
    expect(safeNextPath("/transactions?x=1")).toBe("/transactions?x=1");
    expect(safeNextPath("/onboarding")).toBe("/onboarding");
  });

  it("falls back to home for anything that could leave the site", () => {
    for (const bad of ["//evil.com", "https://x.y", "/\\evil.com", "javascript:alert(1)", "transactions", "", null, undefined]) {
      expect(safeNextPath(bad), String(bad)).toBe("/");
    }
  });
});
