import { fileURLToPath } from "node:url";
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "./client.js";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

/** Applies every pending migration in ./drizzle. Safe to run repeatedly. */
export async function runMigrations(connectionString: string): Promise<void> {
  const handle = createDb(connectionString, { max: 1 });
  try {
    await migrate(handle.db, { migrationsFolder });
  } finally {
    await handle.close();
  }
}

// `pnpm migrate` — explicit step in Compose and on deploy; never run implicitly on API boot.
if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  runMigrations(url)
    .then(() => {
      console.log("migrations applied");
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
