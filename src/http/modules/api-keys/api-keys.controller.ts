import type { RequestHandler } from "express";
import { APIKeysService } from "./api-keys.service.js";

export function apiKeysController(deps: { db: any }): {
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

      const response = await service.createAPIKey(auth.tenantId, { name: req.body.name });
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

      const id = res.locals.params.id;

      const response = await service.getAPIKey(auth.tenantId, id);
      res.status(200).json({ message: "API Key fetched successfully", response });
    },
    updateAPIKey: async (req, res) => {
      const auth = res.locals.auth;
      if (!auth) return res.status(401).json({ message: "A valid bearer token is required." });

      const id = res.locals.params.id;
      const body = res.locals.body;

      const response = await service.updateAPIKey(auth.tenantId, id, body);
      res.status(200).json({ message: "API key updated successfully", response });
    },
    revokeAPIKey: async (req, res) => {
      const auth = res.locals.auth;
      if (!auth) return res.status(401).json({ message: "A valid bearer token is required." });

      const id = res.locals.params.id;

      const response = await service.revokeAPIKey(auth.tenantId, id);
      res.status(200).json({ message: "API key revoked successfully", response });
    },
  };
}
