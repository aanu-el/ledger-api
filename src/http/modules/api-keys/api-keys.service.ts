// api-keys.service.ts
import type { PrismaClient } from "../../../db/prisma.js";
import { generateRawKey } from "../api-keys/utils/api-keys.js";
import { problems } from "../../problem.js";

type Metadata = Record<string, string | number | boolean>;

// Never select keyHash: it should not leave the DB layer.
const publicSelect = {
  id: true,
  name: true,
  prefix: true,
  metadata: true,
  expiresAt: true,
  revokedAt: true,
  lastUsedAt: true,
  createdAt: true,
} as const;

export class APIKeysService {
  constructor(private deps: { db: PrismaClient }) {}

  async createAPIKey(
    tenantId: string,
    input: { name: string; expiresAt?: Date; metadata?: Metadata },
  ) {
    const { key, prefix, keyHash } = generateRawKey();
    const record = await this.deps.db.apiKey.create({
      data: { tenantId, keyHash, prefix, ...input },
      select: publicSelect,
    });
    return { ...record, key }; // plaintext is returned exactly once
  }

  async listAPIKeys(tenantId: string) {
    return this.deps.db.apiKey.findMany({
      where: { tenantId },
      select: publicSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  async getAPIKey(tenantId: string, id: string) {
    const record = await this.deps.db.apiKey.findFirst({
      where: { id, tenantId }, // tenantId in the filter is what prevents IDOR
      select: publicSelect,
    });
    if (!record) throw problems.notFound("API key not found.");
    return record;
  }

  async updateAPIKey(tenantId: string, id: string, input: { name?: string; metadata?: Metadata }) {
    const { count } = await this.deps.db.apiKey.updateMany({
      where: { id, tenantId, revokedAt: null },
      data: input,
    });
    if (count === 0) throw problems.notFound("API key not found.");
    return this.getAPIKey(tenantId, id);
  }

  async revokeAPIKey(tenantId: string, id: string) {
    const { count } = await this.deps.db.apiKey.updateMany({
      where: { id, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw problems.notFound("API key not found.");
  }
}
