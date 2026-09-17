import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, type PoolConfig } from "pg";
import type { Logger } from "../logger.js";
import { PrismaClient } from "../generated/prisma/client.js";

export type Db = PrismaClient;

export interface DbHandle {
  db: Db;
  pool: Pool;
  close(): Promise<void>;
}

/**
 * One pool per process, wrapped by Prisma through its `pg` driver adapter.
 * Owning the pool ourselves (rather than letting Prisma create one) keeps
 * `max`, timeouts and the error listener below under our control.
 *
 * The pool's `error` event fires when an *idle* client loses its connection
 * (Postgres restart, network blip). With no listener, Node treats it as an
 * uncaught exception and kills the process; with one, the client is discarded
 * and the next query simply reconnects. `/health` reports the outage instead.
 *
 * BigInt columns arrive as JS `bigint`; they are serialised to strings at the
 * HTTP layer and never pass through a `number`.
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

  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  return {
    db,
    pool,
    close: async () => {
      await db.$disconnect();
      await pool.end();
    },
  };
}
