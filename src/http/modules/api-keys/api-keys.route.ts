import { Router } from "express";
import type { PrismaClient } from "../../../db/prisma.js";
import { validate } from "../../middleware/validate.js";
import { apiKeysController } from "./api-keys.controller.js";
import { createAPIKeySchema, updateAPIKeySchema } from "./api-keys.validator.js";
import { requireJwt } from "../../middleware/authentication.js";

export function apiKeysRouter(deps: { db: PrismaClient; jwtSecret: string }): Router {
  const router = Router();
  const controller = apiKeysController(deps);

  router.use(requireJwt(deps.jwtSecret));
  router.post("/", validate({ body: createAPIKeySchema }), controller.createAPIKey);
  router.get("/", controller.listAPIKeys);
  router.get("/:id", controller.getAPIKey);
  router.patch("/:id", validate({ body: updateAPIKeySchema }), controller.updateAPIKey);
  router.delete("/:id", controller.revokeAPIKey);

  return router;
}
