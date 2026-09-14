import { sql } from "drizzle-orm";
import pino from "pino";
import { createApp } from "../../src/app.js";
import { createDb, type DbHandle } from "../../src/db/client.js";

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL not set: is the Vitest global setup configured?");
  return url;
}

/**
 * A fully wired app over the shared test database. Each test file gets its own
 * pool; call `reset()` in beforeEach to truncate every application table.
 */
export function createTestApp(overrides: { databaseUrl?: string } = {}) {
  const logger = pino({ level: "silent" });
  const handle: DbHandle = createDb(overrides.databaseUrl ?? testDatabaseUrl(), { max: 5, logger });
  const app = createApp({ db: handle.db, logger });

  return {
    app,
    db: handle.db,
    pool: handle.pool,
    close: () => handle.close(),
    reset: () => truncateAll(handle),
  };
}

async function truncateAll(handle: DbHandle): Promise<void> {
  const result = await handle.pool.query<{ tablename: string }>(
    `select tablename from pg_tables
     where schemaname = 'public' and tablename not like '__drizzle%'`,
  );
  if (result.rows.length === 0) return;
  const names = result.rows.map((r) => `"${r.tablename}"`).join(", ");
  await handle.db.execute(sql.raw(`truncate table ${names} restart identity cascade`));
}
