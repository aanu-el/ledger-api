import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { runMigrations } from "../../src/db/migrate.js";

/**
 * Vitest global setup: one real Postgres for the whole run, migrated once.
 * The connection string is handed to worker processes through process.env,
 * which Vitest forks after this hook resolves.
 */
let container: StartedPostgreSqlContainer | undefined;

export async function setup(): Promise<void> {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("ledger_test")
    .withUsername("ledger")
    .withPassword("ledger")
    .start();

  const url = container.getConnectionUri();
  await runMigrations(url);
  process.env.TEST_DATABASE_URL = url;
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
