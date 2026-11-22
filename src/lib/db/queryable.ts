/**
 * The one thing the data layer needs from a database connection. Satisfied by a `pg` client in the app
 * and by PGlite in tests, so the app's own SQL is what the tests run.
 */
export interface Queryable {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

/** First row or null. */
export async function one<R>(db: Queryable, text: string, params?: unknown[]): Promise<R | null> {
  const { rows } = await db.query<R>(text, params);
  return rows[0] ?? null;
}

/** Postgres error code (e.g. "23505") from a driver error, if there is one. */
export function pgErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return undefined;
}
