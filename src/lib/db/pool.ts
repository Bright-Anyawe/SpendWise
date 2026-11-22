import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { Pool, types } from "pg";

// Value shapes the app expects (src/lib/types/database.ts). Dates stay as calendar strings so a
// server in another time zone can never shift them.
types.setTypeParser(20, (v) => Number(v)); // int8 (count(*))
types.setTypeParser(1082, (v) => v); // date → "YYYY-MM-DD"
types.setTypeParser(1184, (v) => new Date(v).toISOString()); // timestamptz → ISO string
types.setTypeParser(1700, (v) => Number(v)); // numeric → number (totals are summed in SQL)

let pool: Pool | undefined;

/**
 * Shared connection pool over Neon's pooled connection string (DATABASE_URL).
 * On Vercel, attachDatabasePool lets idle clients close before a function instance is suspended.
 */
export function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in (see docs/neon-setup.md).");
  }
  pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 5_000 });
  attachDatabasePool(pool);
  return pool;
}
