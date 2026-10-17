import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../src/http/middleware/error-handler.js";
import { requireJwt } from "../src/http/middleware/authentication.js";
import { requestId } from "../src/http/middleware/request-id.js";

const jwtSecret = "a-test-secret-that-is-at-least-32-characters";

function createProtectedApp() {
  const app = express();
  app.use(requestId);
  app.get("/protected", requireJwt(jwtSecret), (_req, res) => {
    res.json(res.locals.auth);
  });
  app.use(errorHandler);
  return app;
}

function createToken(secret = jwtSecret) {
  return jwt.sign({ tenantId: "tenant-123", email: "tenant@example.com" }, secret, {
    algorithm: "HS256",
    issuer: "ledger-api",
    expiresIn: "1h",
  });
}

describe("requireJwt", () => {
  it("rejects requests without a bearer token", async () => {
    const response = await request(createProtectedApp()).get("/protected");

    expect(response.status).toBe(401);
    expect(response.headers["www-authenticate"]).toBe('Bearer realm="api"');
  });

  it("exposes the tenant claims from a valid token", async () => {
    const response = await request(createProtectedApp())
      .get("/protected")
      .set("Authorization", `Bearer ${createToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      tenantId: "tenant-123",
      email: "tenant@example.com",
    });
  });

  it("rejects tokens signed by another secret", async () => {
    const response = await request(createProtectedApp())
      .get("/protected")
      .set("Authorization", `Bearer ${createToken("another-secret")}`);

    expect(response.status).toBe(401);
  });
});
