import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import type { Logger } from "../logger.js";
import * as schema from "./schema.js";

export type Db = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  pool: Pool;
  close(): Promise<void>;
}

/**
 * One pool per process. `bigint` columns are returned as strings by `pg` by
 * default, which is what we want: balances never pass through a JS number.
 *
 * The pool's `error` event fires when an *idle* client loses its connection
 * (Postgres restart, network blip). With no listener, Node treats it as an
 * uncaught exception and kills the process; with one, the client is discarded
 * and the next query simply reconnects. `/health` reports the outage instead.
 */
export function createDb(
  connectionString: string,
  opts: { logger?: Logger } & PoolConfig = {},
): DbHandle {
  const { logger, ...poolConfig } = opts;
  const pool = new Pool({ connectionString, max: 10, ...poolConfig });
  pool.on("error", (err) => {
    logger?.warn({ err }, "idle database client errored; it will be replaced");
  });
  const db = drizzle(pool, { schema });
  return { db, pool, close: () => pool.end() };
}
