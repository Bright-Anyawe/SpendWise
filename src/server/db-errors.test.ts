import { describe, expect, it } from "vitest";
import { friendlyDbError } from "./db-errors";

describe("friendlyDbError", () => {
  it("explains duplicates per kind of record", () => {
    expect(friendlyDbError("23505", "category")).toBe("You already have a category with that name.");
    expect(friendlyDbError("23505", "budget")).toBe("You already have a budget for that period and category.");
  });

  it("explains a missing category", () => {
    expect(friendlyDbError("23503", "expense")).toBe("That category no longer exists. Pick another one.");
  });

  it("falls back to a generic message", () => {
    expect(friendlyDbError(undefined, "expense")).toBe("Something went wrong saving that. Please try again.");
  });
});
