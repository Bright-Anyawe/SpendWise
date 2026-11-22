import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { migrate } from "../../scripts/lib/migrator.mjs";
import { pgliteExecutor } from "./helpers/db";

describe("migrate", () => {
  it("applies pending migrations once, in order", async () => {
    const pg = new PGlite();
    const db = pgliteExecutor(pg);
    const migrations = [
      { name: "001_a.sql", sql: "create table a (id int);" },
      { name: "002_b.sql", sql: "create table b (id int); insert into a values (1);" },
    ];

    expect(await migrate(db, migrations, () => {})).toEqual(["001_a.sql", "002_b.sql"]);
    expect(await migrate(db, migrations, () => {})).toEqual([]);

    const recorded = await pg.query<{ name: string }>("select name from app.schema_migrations order by name");
    expect(recorded.rows.map((r) => r.name)).toEqual(["001_a.sql", "002_b.sql"]);
    const a = await pg.query<{ n: number }>("select count(*)::int as n from a");
    expect(a.rows[0].n).toBe(1);
    await pg.close();
  });

  it("rolls back and does not record a failing migration", async () => {
    const pg = new PGlite();
    const db = pgliteExecutor(pg);
    const migrations = [
      { name: "001_ok.sql", sql: "create table ok (id int);" },
      { name: "002_bad.sql", sql: "create table half (id int); select * from does_not_exist;" },
    ];

    await expect(migrate(db, migrations, () => {})).rejects.toThrow(/002_bad\.sql/);

    const recorded = await pg.query<{ name: string }>("select name from app.schema_migrations");
    expect(recorded.rows.map((r) => r.name)).toEqual(["001_ok.sql"]);
    const half = await pg.query<{ n: number }>("select count(*)::int as n from pg_tables where tablename = 'half'");
    expect(half.rows[0].n).toBe(0);
    await pg.close();
  });
});
