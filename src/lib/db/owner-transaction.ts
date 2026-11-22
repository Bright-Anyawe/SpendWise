import "server-only";
import { getPool } from "./pool";
import type { Queryable } from "./queryable";

/**
 * Runs `fn` in one transaction as the database owner, which Row Level Security does not limit.
 * Only for the server's own work across people (the reminder job, moving a push subscription
 * between accounts) — never with SQL built from what a person typed, and never for a page.
 */
export async function withOwnerTransaction<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const db: Queryable = {
      query: async <R,>(text: string, params?: unknown[]) => (await client.query(text, params)) as unknown as { rows: R[] },
    };
    const result = await fn(db);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
