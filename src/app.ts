import express, { type Express } from "express";
import type { PrismaClient } from "./db/prisma.js";
import type { Logger } from "./logger.js";
import { requestId } from "./http/middleware/request-id.js";
import { requestLogger } from "./http/middleware/request-logger.js";
import { errorHandler, notFoundHandler } from "./http/middleware/error-handler.js";
import { healthRouter } from "./http/modules/health/health.js";
import { authRouter } from "./http/modules/auth/auth.route.js";
import { apiKeysRouter } from "./http/modules/api-keys/api-keys.route.js";

export interface AppDeps {
  db: PrismaClient;
  logger: Logger;
  jwtSecret: string;
}

/**
 * Builds the Express app from explicit dependencies. Nothing here touches
 * process.env or opens connections, so tests can construct it with a
 * Testcontainers database and a silent logger.
 */
export function createApp(deps: AppDeps): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", true);

  app.use(requestId);
  app.use(requestLogger(deps.logger));
  app.use(express.json({ limit: "64kb" }));

  app.use(healthRouter({ db: deps.db }));
  app.use("/api/auth", authRouter({ db: deps.db, jwtSecret: deps.jwtSecret }));
  app.use("/api/v1/api-keys", apiKeysRouter({ db: deps.db, jwtSecret: deps.jwtSecret }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
