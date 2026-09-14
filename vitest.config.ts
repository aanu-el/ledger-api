import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/setup/global.ts"],
    // Testcontainers startup + real Postgres round-trips; keep generous.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // One Postgres container is shared by all files; files run in parallel
    // workers, so each file must reset its own tables (see test/setup/db.ts).
    pool: "forks",
  },
});
