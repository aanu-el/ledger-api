import type { NextFunction, RequestHandler, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { problems } from "../problem.js";
import type { PrismaClient } from "../../db/prisma.js";

export interface JWTAuthenticatedTenant {
  tenantId: string;
  email: string;
}

export interface APIKeyAuthenticatedTenant {
  tenantId: string;
  apiKeyId: string;
}

export type AuthenticatedTenant = JWTAuthenticatedTenant | APIKeyAuthenticatedTenant;

declare global {
  namespace Express {
    interface Locals {
      auth?: AuthenticatedTenant;
    }
  }
}

export function requireJwt(jwtSecret: string): RequestHandler {
  return (req, res, next) => {
    const isJwt = true;
    const authorization = req.get("authorization");
    const token = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];

    if (!token) {
      return rejectUnauthorized(res, next, isJwt);
    }

    let payload: string | JwtPayload;
    try {
      payload = jwt.verify(token, jwtSecret, {
        algorithms: ["HS256"],
        issuer: "ledger-api",
      });
    } catch {
      return rejectUnauthorized(res, next, isJwt);
    }

    if (!isAuthenticatedTenant(payload)) {
      return rejectUnauthorized(res, next, isJwt);
    }

    res.locals.auth = {
      tenantId: payload.tenantId,
      email: payload.email,
    };
    return next();
  };
}

export function requireAPIKey(db: PrismaClient): RequestHandler {
  return async (req, res, next) => {
    const isJwt = false;
    const authorization = req.get("authorization");
    const key = authorization?.match(/^ApiKey ([^\s]+)$/i)?.[1];

    if (!key) {
      return rejectUnauthorized(res, next, isJwt);
    }

    const record = await db.apiKey.findUnique({ where: { keyHash: key } });
    if (!record || record.revokedAt || (record.expiresAt && record.expiresAt <= new Date())) {
      return next(problems.unauthorized("Invalid API key."));
    }

    res.locals.auth = { tenantId: record.tenantId, apiKeyId: record.id };
    return next();
  };
}

function rejectUnauthorized(res: Response, next: NextFunction, isJwt: boolean): void {
  if (!isJwt) {
    res.set("WWW-Authenticate", 'ApiKey realm="api"');
    next(problems.unauthorized("A valid API key is required."));
    return;
  }
  res.set("WWW-Authenticate", 'Bearer realm="api"');
  next(problems.unauthorized("A valid bearer token is required."));
}

function isAuthenticatedTenant(
  payload: string | JwtPayload,
): payload is JwtPayload & AuthenticatedTenant {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof payload.tenantId === "string" &&
    typeof payload.email === "string"
  );
}
