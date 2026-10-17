import type { RequestHandler } from "express";
import type { PrismaClient } from "../../../db/prisma.js";
import { getInput } from "../../middleware/validate.js";
import { APIKeysService } from "./api-keys.service.js";
import {
  apiKeyParamsSchema,
  createAPIKeySchema,
  updateAPIKeySchema,
} from "./api-keys.validator.js";

export function apiKeysController(deps: { db: PrismaClient }): {
  createAPIKey: RequestHandler;
  listAPIKeys: RequestHandler;
  getAPIKey: RequestHandler;
  updateAPIKey: RequestHandler;
  revokeAPIKey: RequestHandler;
} {
  const service = new APIKeysService(deps);

  return {
    createAPIKey: async (req, res) => {
      const auth = res.locals.auth;
      if (!auth) return res.status(401).json({ message: "A valid bearer token is required." });

      const { body } = getInput<{ body: typeof createAPIKeySchema }>(res);
      const response = await service.createAPIKey(auth.tenantId, {
        name: body.name,
        ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt } : {}),
        ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
      });
      res
        .set("Cache-Control", "no-store")
        .status(201)
        .json({ message: "API key created successfully", response });
    },
    listAPIKeys: async (req, res) => {
      const auth = res.locals.auth;
      if (!auth) return res.status(401).json({ message: "A valid bearer token is required." });

      const response = await service.listAPIKeys(auth.tenantId);
      res.status(200).json({ message: "API Keys fetched successfully", response });
    },
    getAPIKey: async (req, res) => {
      const auth = res.locals.auth;
      if (!auth) return res.status(401).json({ message: "A valid bearer token is required." });

      const { params } = getInput<{ params: typeof apiKeyParamsSchema }>(res);
      const id = params.id;

      const response = await service.getAPIKey(auth.tenantId, id);
      res.status(200).json({ message: "API Key fetched successfully", response });
    },
    updateAPIKey: async (req, res) => {
      const auth = res.locals.auth;
      if (!auth) return res.status(401).json({ message: "A valid bearer token is required." });

      const { params, body } = getInput<{
        params: typeof apiKeyParamsSchema;
        body: typeof updateAPIKeySchema;
      }>(res);
      const id = params.id;

      const response = await service.updateAPIKey(auth.tenantId, id, body);
      res.status(200).json({ message: "API key updated successfully", response });
    },
    revokeAPIKey: async (req, res) => {
      const auth = res.locals.auth;
      if (!auth) return res.status(401).json({ message: "A valid bearer token is required." });

      const { params } = getInput<{ params: typeof apiKeyParamsSchema }>(res);
      const id = params.id;

      const response = await service.revokeAPIKey(auth.tenantId, id);
      res.status(200).json({ message: "API key revoked successfully", response });
    },
  };
}
