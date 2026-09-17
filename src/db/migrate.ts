import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

/**
 * Applies every pending migration in prisma/migrations by running
 * `prisma migrate deploy`. Used by the test global setup; `pnpm migrate`,
 * Compose and the deploy hook call the CLI directly.
 */
export function runMigrations(connectionString: string): void {
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: connectionString },
    stdio: "pipe",
  });
}
