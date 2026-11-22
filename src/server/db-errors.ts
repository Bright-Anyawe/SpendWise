export type RecordKind = "expense" | "category" | "budget";

const DUPLICATE: Record<RecordKind, string> = {
  expense: "That expense was already saved.",
  category: "You already have a category with that name.",
  budget: "You already have a budget for that period and category.",
};

/** Turns a Postgres error code into words a person can act on. */
export function friendlyDbError(code: string | undefined, kind: RecordKind): string {
  if (code === "23505") return DUPLICATE[kind];
  if (code === "23503") return "That category no longer exists. Pick another one.";
  if (code === "23514") return "Some of those values aren't allowed. Check them and try again.";
  return "Something went wrong saving that. Please try again.";
}
