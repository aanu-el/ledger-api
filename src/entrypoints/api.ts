import { createApp } from "../app.js";
import { loadConfig } from "../config/index.js";
import { createDb } from "../db/client.js";
import { createLogger } from "../logger.js";

const config = loadConfig();
const logger = createLogger({ level: config.LOG_LEVEL, pretty: config.NODE_ENV === "development" });
const dbHandle = createDb(config.DATABASE_URL, { logger });

const app = createApp({ db: dbHandle.db, logger });

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
    dbHandle
      .close()
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
