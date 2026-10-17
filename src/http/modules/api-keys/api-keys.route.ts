import { Router } from "express";
import type { PrismaClient } from "../../../db/prisma.js";
import { validate } from "../../middleware/validate.js";
import { apiKeysController } from "./api-keys.controller.js";
import {
  apiKeyParamsSchema,
  createAPIKeySchema,
  updateAPIKeySchema,
} from "./api-keys.validator.js";
import { requireJwt } from "../../middleware/authentication.js";

export function apiKeysRouter(deps: { db: PrismaClient; jwtSecret: string }): Router {
  const router = Router();
  const controller = apiKeysController(deps);

  router.use(requireJwt(deps.jwtSecret));
  router.post("/", validate({ body: createAPIKeySchema }), controller.createAPIKey);
  router.get("/", controller.listAPIKeys);
  router.get("/:id", validate({ params: apiKeyParamsSchema }), controller.getAPIKey);
  router.patch(
    "/:id",
    validate({ params: apiKeyParamsSchema, body: updateAPIKeySchema }),
    controller.updateAPIKey,
  );
  router.delete("/:id", validate({ params: apiKeyParamsSchema }), controller.revokeAPIKey);

  return router;
}
