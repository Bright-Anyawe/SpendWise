import { randomUUID } from "node:crypto";
import path from "node:path";
import { PGlite, type ParserOptions, type Transaction } from "@electric-sql/pglite";
import { loadMigrations, migrate, type SqlExecutor } from "../../../scripts/lib/migrator.mjs";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

/** The same value shapes the app's `pg` pool produces (see src/lib/db/pool.ts). */
export const APP_PARSERS: ParserOptions = {
  20: (v) => Number(v), // int8
  1082: (v) => v, // date → "YYYY-MM-DD"
  1184: (v) => new Date(v).toISOString(), // timestamptz → ISO string
  1700: (v) => Number(v), // numeric → number
};

/** Adapts PGlite to the migrator's executor (multi-statement SQL goes through exec). */
export function pgliteExecutor(pg: PGlite): SqlExecutor {
  return {
    async query(sql, params) {
      if (params) return pg.query(sql, params);
      const results = await pg.exec(sql);
      return results[results.length - 1] ?? { rows: [] };
    },
  };
}

export interface CreateUserOptions {
  displayName?: string;
  timezone?: string;
  weekStartsOn?: number;
}

export interface TestDb {
  /** Owner connection: like the server's own jobs, it bypasses RLS. Use for setup and for checking results. */
  pg: PGlite;
  /** A signed-in person: their id plus the profile, preferences and categories created on first sign-in. */
  createUser(opts?: CreateUserOptions): Promise<string>;
  /** Runs fn in a transaction exactly as the app does for a signed-in person (role spendwise_user + app.user_id). */
  asUser<T>(userId: string, fn: (tx: Transaction) => Promise<T>): Promise<T>;
  /** The app role with no person attached. */
  asSignedOut<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  /** Any other database role (one with no grants at all). */
  asOutsider<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function createTestDb(opts: { appParsers?: boolean } = {}): Promise<TestDb> {
  const pg = new PGlite(opts.appParsers ? { parsers: APP_PARSERS } : undefined);
  await pg.exec("create role outsider nologin;");
  await migrate(pgliteExecutor(pg), loadMigrations(MIGRATIONS_DIR), () => {});

  function asRole<T>(role: string, userId: string | null, fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return pg.transaction(async (tx) => {
      await tx.query("select set_config('role', $1, true), set_config('app.user_id', $2, true)", [role, userId ?? ""]);
      return fn(tx);
    });
  }

  const db: TestDb = {
    pg,
    async createUser(options = {}) {
      const id = randomUUID();
      await asRole("spendwise_user", id, (tx) => tx.query("select app.ensure_profile($1)", [options.displayName ?? null]));
      if (options.timezone || options.weekStartsOn !== undefined) {
        await pg.query(
          "update public.profiles set timezone = coalesce($2, timezone), week_starts_on = coalesce($3, week_starts_on) where id = $1",
          [id, options.timezone ?? null, options.weekStartsOn ?? null],
        );
      }
      return id;
    },
    asUser: (userId, fn) => asRole("spendwise_user", userId, fn),
    asSignedOut: (fn) => asRole("spendwise_user", null, fn),
    asOutsider: (fn) => asRole("outsider", null, fn),
    close: () => pg.close(),
  };
  return db;
}

/** Looks up one of a person's categories by name (owner read). */
export async function categoryId(db: TestDb, userId: string, name: string): Promise<string> {
  const { rows } = await db.pg.query<{ id: string }>(
    "select id from public.categories where user_id = $1 and name = $2",
    [userId, name],
  );
  if (!rows[0]) throw new Error(`No category "${name}" for user ${userId}`);
  return rows[0].id;
}
