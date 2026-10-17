import { Router } from "express";
import type { PrismaClient } from "../../../db/prisma.js";
import { authController } from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { signinSchema, signupSchema } from "./auth.validator.js";

export function authRouter(deps: { db: PrismaClient; jwtSecret: string }): Router {
  const router = Router();
  const controller = authController(deps);

  // tenants auth routes
  router.post("/signup", validate({ body: signupSchema }), controller.signup);
  router.post("/signin", validate({ body: signinSchema }), controller.signin);

  return router;
}
