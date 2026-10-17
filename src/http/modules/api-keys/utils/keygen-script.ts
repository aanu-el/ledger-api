// scripts/issue-key.ts
import { parseArgs } from "node:util";
import { createPrismaClient } from "../../../../db/prisma.js";
import { APIKeysService } from "../api-keys.service.js";
import { loadEnvConfig } from "../../../../config/index.js";

const config = loadEnvConfig();
const dbClient = createPrismaClient(config.DATABASE_URL);
const authService = new APIKeysService({ db: dbClient });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const { values } = parseArgs({
  options: {
    tenant: { type: "string" },
    name: { type: "string", default: "cli-issued" },
    "expires-in-days": { type: "string" },
  },
});

async function main() {
  if (!values.tenant || !UUID.test(values.tenant)) {
    console.error("Usage: pnpm issue-key --tenant <uuid> [--name <label>] [--expires-in-days <n>]");
    process.exitCode = 1;
    return;
  }

  const tenant = await dbClient.tenant.findUnique({
    where: { id: values.tenant },
    select: { id: true, name: true },
  });
  if (!tenant) {
    console.error(`Tenant ${values.tenant} not found.`);
    process.exitCode = 1;
    return;
  }

  const days = values["expires-in-days"] ? Number(values["expires-in-days"]) : undefined;
  if (days !== undefined && (!Number.isFinite(days) || days <= 0)) {
    console.error("--expires-in-days must be a positive number.");
    process.exitCode = 1;
    return;
  }

  const created = await authService.createAPIKey(tenant.id, {
    name: values.name!,
    expiresAt: new Date(Date.now() + (days ?? 0) * 86_400_000),
  });

  console.error(`Issued key "${created.name}" for tenant "${tenant.name}". Shown once:`);
  console.log(created.key); // stdout carries only the key, so it can be piped or captured
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => dbClient.$disconnect());
