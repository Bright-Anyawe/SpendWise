import { describe, expect, it } from "vitest";
import { applyKey } from "./keypad";

const type = (keys: string[], start = "") => keys.reduce(applyKey, start);

describe("applyKey", () => {
  it("builds an amount from digits and one decimal point", () => {
    expect(type(["3", "5"])).toBe("35");
    expect(type(["3", "5", ".", "5", "0"])).toBe("35.50");
  });

  it("never keeps a leading zero", () => {
    expect(type(["0"])).toBe("0");
    expect(type(["0", "0"])).toBe("0");
    expect(type(["0", "5"])).toBe("5");
  });

  it("starts a decimal with 0 and allows only one point", () => {
    expect(type(["."])).toBe("0.");
    expect(type(["1", ".", "."])).toBe("1.");
  });

  it("stops at two decimals and nine whole digits", () => {
    expect(applyKey("12.34", "5")).toBe("12.34");
    expect(applyKey("123456789", "0")).toBe("123456789");
    expect(applyKey("123456789", ".")).toBe("123456789.");
  });

  it("deletes the last character and ignores unknown keys", () => {
    expect(applyKey("35.5", "del")).toBe("35.");
    expect(applyKey("", "del")).toBe("");
    expect(applyKey("35", "x")).toBe("35");
  });
});
