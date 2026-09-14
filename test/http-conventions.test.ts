import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./setup/app.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("HTTP conventions", () => {
  const t = createTestApp();
  afterAll(() => t.close());

  describe("request id", () => {
    it("mints a request id and echoes it on every response", async () => {
      const res = await request(t.app).get("/health");
      expect(res.headers["x-request-id"]).toMatch(UUID);
    });

    it("honours a caller-supplied request id", async () => {
      const res = await request(t.app).get("/health").set("X-Request-Id", "client-abc-123");
      expect(res.headers["x-request-id"]).toBe("client-abc-123");
    });
  });

  describe("problem+json errors", () => {
    it("returns a problem document for an unknown route", async () => {
      const res = await request(t.app).get("/definitely-not-a-route");

      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(res.body).toEqual({
        type: "urn:ledger:problem:not-found",
        title: "Not Found",
        status: 404,
        detail: "No route for GET /definitely-not-a-route",
        request_id: res.headers["x-request-id"],
      });
    });

    it("returns a validation problem for malformed JSON", async () => {
      const res = await request(t.app)
        .post("/health")
        .set("Content-Type", "application/json")
        .send("{not json");

      // POST /health doesn't exist, but body parsing runs first and must fail cleanly.
      expect(res.status).toBe(400);
      expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(res.body).toMatchObject({
        type: "urn:ledger:problem:validation-failed",
        status: 400,
        errors: [{ path: "body", message: "Malformed JSON body" }],
      });
      expect(res.body.request_id).toMatch(UUID);
    });

    it("never leaks a server header", async () => {
      const res = await request(t.app).get("/health");
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });
  });
});
