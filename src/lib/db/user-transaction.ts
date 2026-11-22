import "server-only";
import { getPool } from "./pool";
import type { Queryable } from "./queryable";

/**
 * Runs `fn` in one transaction as the signed-in person: the restricted role spendwise_user with
 * app.user_id set, so Row Level Security limits every query to their own rows.
 * Both settings are transaction-local, which is safe on Neon's pooled (PgBouncer) connection.
 */
export async function withUserTransaction<T>(userId: string, fn: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('role', 'spendwise_user', true), set_config('app.user_id', $1, true)", [userId]);
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
