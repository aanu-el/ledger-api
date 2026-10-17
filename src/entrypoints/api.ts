import { createApp } from "../app.js";
import { loadEnvConfig } from "../config/index.js";
import { createPrismaClient } from "../db/prisma.js";
import { createLogger } from "../logger.js";

const config = loadEnvConfig();
const logger = createLogger({ level: config.LOG_LEVEL, pretty: config.NODE_ENV === "development" });
const dbClient = createPrismaClient(config.DATABASE_URL);
const jwtSecret = config.JWT_SECRET;

const app = createApp({ db: dbClient, logger, jwtSecret });

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, "api listening");
});

// Finish in-flight requests, then release the pool. Deploys send SIGTERM;
// anything still open after the grace period is cut off.
const SHUTDOWN_GRACE_MS = 10_000;
let shuttingDown = false;

function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  const forceExit = setTimeout(() => {
    logger.error("forced exit after grace period");
    process.exit(1);
  }, SHUTDOWN_GRACE_MS).unref();

  server.close(() => {
    dbClient
      .$disconnect()
      .then(() => {
        clearTimeout(forceExit);
        logger.info("shutdown complete");
        process.exit(0);
      })
      .catch((err: unknown) => {
        logger.error({ err }, "error during shutdown");
        process.exit(1);
      });
  });
  server.closeIdleConnections();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
