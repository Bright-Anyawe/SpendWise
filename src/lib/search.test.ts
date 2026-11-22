import { describe, expect, it } from "vitest";
import { toIlikePattern } from "./search";

describe("toIlikePattern", () => {
  it("wraps plain text for a contains search", () => {
    expect(toIlikePattern("lunch")).toBe("%lunch%");
    expect(toIlikePattern("  trotro ")).toBe("%trotro%");
  });

  it("removes filter syntax characters and escapes wildcards", () => {
    expect(toIlikePattern("a,b(c)%")).toBe("%abc\\%%");
    expect(toIlikePattern("50_off")).toBe("%50\\_off%");
    expect(toIlikePattern('say "hi"')).toBe("%say hi%");
    expect(toIlikePattern("a*b")).toBe("%ab%");
    expect(toIlikePattern("back\\slash")).toBe("%back\\\\slash%");
  });

  it("returns null when nothing searchable is left", () => {
    expect(toIlikePattern("")).toBeNull();
    expect(toIlikePattern(" ,() ")).toBeNull();
  });
});
