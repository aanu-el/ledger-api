import express, { type Express } from "express";
import type { Db } from "./db/client.js";
import type { Logger } from "./logger.js";
import { requestId } from "./http/middleware/request-id.js";
import { requestLogger } from "./http/middleware/request-logger.js";
import { errorHandler, notFoundHandler } from "./http/middleware/error-handler.js";
import { healthRouter } from "./http/routes/health.js";

export interface AppDeps {
  db: Db;
  logger: Logger;
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
