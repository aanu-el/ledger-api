import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./setup/app.js";
import { issueApiKey } from "../src/services/api-keys.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("accounts", () => {
  const t = createTestApp();
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  describe("authentication", () => {
    it("rejects a request with no Authorization header", async () => {
      const res = await request(t.app).post("/v1/accounts").send({ currency: "USD" });

      expect(res.status).toBe(401);
      expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(res.body).toMatchObject({
        type: "urn:ledger:problem:unauthenticated",
        status: 401,
      });
      expect(res.headers["www-authenticate"]).toBe("Bearer");
    });

    it("rejects a malformed Authorization header", async () => {
      const res = await request(t.app)
        .post("/v1/accounts")
        .set("Authorization", "Basic abc")
        .send({ currency: "USD" });

      expect(res.status).toBe(401);
    });

    it("rejects an unknown key", async () => {
      const res = await request(t.app)
        .post("/v1/accounts")
        .set("Authorization", "Bearer lk_definitely_not_a_real_key")
        .send({ currency: "USD" });

      expect(res.status).toBe(401);
      expect(res.body.type).toBe("urn:ledger:problem:unauthenticated");
    });

    it("stores only a hash of the key, never the key itself", async () => {
      const { apiKey } = await issueApiKey(t.db, { tenantName: "acme" });

      const rows = await t.pool.query<{ key_hash: string }>("select key_hash from api_keys");
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0]!.key_hash).not.toContain(apiKey);
      expect(rows.rows[0]!.key_hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("POST /v1/accounts", () => {
    it("creates an account in a currency, starting at zero balance", async () => {
      const { apiKey } = await issueApiKey(t.db, { tenantName: "acme" });

      const res = await request(t.app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ currency: "USD" });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.stringMatching(UUID),
        currency: "USD",
        balance: "0",
        kind: "user",
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
      expect(res.headers.location).toBe(`/v1/accounts/${res.body.id}`);
    });

    it("rejects an invalid currency with a field-level validation error", async () => {
      const { apiKey } = await issueApiKey(t.db, { tenantName: "acme" });

      const res = await request(t.app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ currency: "us" });

      expect(res.status).toBe(400);
      expect(res.body.type).toBe("urn:ledger:problem:validation-failed");
      expect(res.body.errors).toEqual([{ path: "body.currency", message: expect.any(String) }]);
    });
  });

  describe("GET /v1/accounts/:id", () => {
    it("returns the account to its owner", async () => {
      const { apiKey } = await issueApiKey(t.db, { tenantName: "acme" });
      const created = await request(t.app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ currency: "EUR" });

      const res = await request(t.app)
        .get(`/v1/accounts/${created.body.id}`)
        .set("Authorization", `Bearer ${apiKey}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(created.body);
    });

    it("is invisible to another tenant (404, not 403 — existence is not leaked)", async () => {
      const acme = await issueApiKey(t.db, { tenantName: "acme" });
      const globex = await issueApiKey(t.db, { tenantName: "globex" });
      const created = await request(t.app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer ${acme.apiKey}`)
        .send({ currency: "USD" });

      const res = await request(t.app)
        .get(`/v1/accounts/${created.body.id}`)
        .set("Authorization", `Bearer ${globex.apiKey}`);

      expect(res.status).toBe(404);
      expect(res.body.type).toBe("urn:ledger:problem:not-found");
    });

    it("returns 404 for a well-formed id that does not exist", async () => {
      const { apiKey } = await issueApiKey(t.db, { tenantName: "acme" });

      const res = await request(t.app)
        .get("/v1/accounts/00000000-0000-4000-8000-000000000000")
        .set("Authorization", `Bearer ${apiKey}`);

      expect(res.status).toBe(404);
    });

    it("returns a validation error for a malformed id", async () => {
      const { apiKey } = await issueApiKey(t.db, { tenantName: "acme" });

      const res = await request(t.app)
        .get("/v1/accounts/not-a-uuid")
        .set("Authorization", `Bearer ${apiKey}`);

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual([{ path: "params.id", message: expect.any(String) }]);
    });
  });
});
