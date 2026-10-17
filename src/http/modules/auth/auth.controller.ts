import type { RequestHandler } from "express";
import type { PrismaClient } from "../../../db/prisma.js";
import { AuthService } from "./auth.service.js";
import { getInput } from "../../middleware/validate.js";
import { signinSchema, signupSchema } from "./auth.validator.js";

export function authController(deps: { db: PrismaClient; jwtSecret: string }): {
  signup: RequestHandler;
  signin: RequestHandler;
} {
  const authService = new AuthService(deps);

  return {
    signup: async (req, res) => {
      const { body } = getInput<{ body: typeof signupSchema }>(res);
      const response = await authService.signup(body);
      res.status(200).json({ message: "Tenant signed up successfully", response });
    },
    signin: async (req, res) => {
      const { body } = getInput<{ body: typeof signinSchema }>(res);
      const response = await authService.signin(body.email, body.password);
      res.status(200).json({ message: "Tenant signed in successfully", response });
    },
  };
}
