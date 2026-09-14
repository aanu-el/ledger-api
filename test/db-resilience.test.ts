import { describe, expect, it } from "vitest";
import request from "supertest";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { createTestApp } from "./setup/app.js";

// testcontainers-node has no stop-and-restart-in-place API. Stopping through
// the CLI sends SIGTERM (Postgres closes every connection, which is what
// triggers the pool's idle-client `error` event); `docker start` brings it
// back. Docker re-randomises an ephemeral host port on restart, so the
// container is bound to a fixed free port to keep the connection URI valid.
const docker = (...args: string[]) => execFileSync("docker", args, { stdio: "ignore" });

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") return reject(new Error("no port"));
      srv.close(() => resolve(addr.port));
    });
    srv.on("error", reject);
  });
}

/**
 * Regression test for a crash found during manual verification: `pg` emits an
 * `error` event on idle pooled clients when the server goes away, and an
 * unhandled one kills the process. The API must survive a database outage,
 * report it via /health, and recover once the database is back.
 *
 * Uses its own container so stopping it cannot disturb other test files.
 */
describe("database outage", () => {
  it("survives Postgres going away and recovers when it returns", async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine")
      .withExposedPorts({ container: 5432, host: await freePort() })
      .start();
    const t = createTestApp({ databaseUrl: container.getConnectionUri() });

    try {
      // Warm the pool so an idle client exists to receive the disconnect.
      expect((await request(t.app).get("/health")).status).toBe(200);
      expect(t.pool.idleCount).toBeGreaterThan(0);

      docker("stop", "-t", "5", container.getId());
      // Give the idle client's socket close a tick to propagate as an event.
      await sleep(200);

      const down = await request(t.app).get("/health");
      expect(down.status).toBe(503);
      expect(down.body).toEqual({ status: "degraded", checks: { db: "unhealthy" } });

      docker("start", container.getId());
      const up = await waitFor(
        () => request(t.app).get("/health"),
        (r) => r.status === 200,
      );
      expect(up.body).toEqual({ status: "ok", checks: { db: "ok" } });
    } finally {
      await t.close();
      await container.stop();
    }
  }, 60_000);
});

async function waitFor<T>(
  fn: () => Promise<T>,
  ok: (v: T) => boolean,
  { attempts = 50, intervalMs = 200 } = {},
): Promise<T> {
  let last!: T;
  for (let i = 0; i < attempts; i++) {
    last = await fn();
    if (ok(last)) return last;
    await sleep(intervalMs);
  }
  return last;
}
