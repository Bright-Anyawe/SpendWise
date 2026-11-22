// Minimal SQL migration runner. Plain JavaScript so `node scripts/migrate.mjs` runs it with no build step.
// Applied migrations are recorded in app.schema_migrations; each file runs in its own transaction.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * @typedef {{ query(sql: string, params?: unknown[]): Promise<{ rows: any[] }> }} SqlExecutor
 * @typedef {{ name: string, sql: string }} Migration
 */

/**
 * Reads every .sql file in `dir`, sorted by filename.
 * @param {string} dir
 * @returns {Migration[]}
 */
export function loadMigrations(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(dir, name), "utf8") }));
}

/**
 * Applies the migrations that haven't run yet, in order. Returns the names it applied.
 * @param {SqlExecutor} db
 * @param {Migration[]} migrations
 * @param {(message: string) => void} [log]
 * @returns {Promise<string[]>}
 */
export async function migrate(db, migrations, log = console.log) {
  await db.query(
    "create schema if not exists app; " +
      "create table if not exists app.schema_migrations (name text primary key, applied_at timestamptz not null default now());",
  );
  const { rows } = await db.query("select name from app.schema_migrations");
  const applied = new Set(rows.map((r) => r.name));
  const pending = migrations.filter((m) => !applied.has(m.name));

  for (const migration of pending) {
    await db.query("begin");
    try {
      await db.query(migration.sql);
      await db.query("insert into app.schema_migrations (name) values ($1)", [migration.name]);
      await db.query("commit");
      log(`applied ${migration.name}`);
    } catch (error) {
      await db.query("rollback");
      throw new Error(`Migration ${migration.name} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (pending.length === 0) log("database is up to date");
  return pending.map((m) => m.name);
}
