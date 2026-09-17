import { defineConfig } from "prisma/config";

// Prisma 7 keeps connection details out of schema.prisma. The CLI (migrate,
// studio) reads this file; the runtime client gets its connection from the
// pg adapter in src/db/client.ts. `pnpm migrate*` scripts load .env first.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Present for the CLI; the runtime client never reads this file.
    url: process.env.DATABASE_URL ?? "",
  },
});
