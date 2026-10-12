import { Router } from "express";
import type { PrismaClient } from "../../db/prisma.js";

/**
 * GET /health — 200 when the API is up and can reach the database, 503 otherwise.
 * Render polls this to decide whether the instance is ready for traffic.
 */
export function healthRouter(deps: { db: PrismaClient }): Router {
  const router = Router();

  router.get("/health", async (req, res) => {
    try {
      await deps.db.$queryRaw`select 1`;
      res.json({ status: "ok" });
    } catch (err) {
      req.log.error({ err }, "database health check failed");
      res.status(503).json({ status: "unhealthy" });
    }
  });

  return router;
}
