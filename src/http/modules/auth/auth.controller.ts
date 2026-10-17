import type { RequestHandler } from "express";
import type { PrismaClient } from "../../../db/prisma.js";
import { AuthService } from "./auth.service.js";
import { problems } from "../../problem.js";

export function authController(deps: { db: PrismaClient; jwtSecret: string }): {
  signup: RequestHandler;
  signin: RequestHandler;
} {
  const authService = new AuthService(deps);

  return {
    signup: async (req, res) => {
      const response = await authService.signup(req.body);
      res.status(200).json({ message: "Tenant signed up successfully", response });
    },
    signin: async (req, res) => {
      const response = await authService.signin(req.body.email, req.body.password);
      res.status(200).json({ message: "Tenant signed in successfully", response });
    },
  };
}
