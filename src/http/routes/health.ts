import { Router } from "express";
import { sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";

export type CheckStatus = "ok" | "unhealthy";

export interface HealthReport {
  status: "ok" | "degraded";
  checks: Record<string, CheckStatus>;
}

const CHECK_TIMEOUT_MS = 2_000;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Liveness + readiness in one. 200 when every dependency answers, 503
 * otherwise, with per-check detail so an operator can see which one is sick.
 */
export function healthRouter(deps: { db: Db }): Router {
  const router = Router();

  router.get("/health", async (_req, res) => {
    const checks: HealthReport["checks"] = {};

    try {
      await withTimeout(deps.db.execute(sql`select 1`), CHECK_TIMEOUT_MS);
      checks.db = "ok";
    } catch {
      checks.db = "unhealthy";
    }

    const healthy = Object.values(checks).every((c) => c === "ok");
    const report: HealthReport = { status: healthy ? "ok" : "degraded", checks };
    res.status(healthy ? 200 : 503).json(report);
  });

  return router;
}
