// Applies db/migrations/*.sql to the Neon database, in order, once each.
// Usage: npm run db:migrate   (reads .env.local / .env, or the environment on CI/Vercel)
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadMigrations, migrate } from "./lib/migrator.mjs";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File not present: rely on the environment.
  }
}

// Migrations need the direct (non-pooled) connection; fall back to DATABASE_URL with a warning.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL_UNPOOLED (Neon's direct connection string) — see docs/neon-setup.md.");
  process.exit(1);
}
if (new URL(url).hostname.includes("-pooler")) {
  console.warn("Warning: using a pooled connection string. Set DATABASE_URL_UNPOOLED to the direct one for migrations.");
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await migrate(client, loadMigrations(path.join(root, "db", "migrations")));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
