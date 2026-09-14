import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./setup/app.js";

describe("GET /health", () => {
  const t = createTestApp();
  afterAll(() => t.close());

  it("reports ok when the database answers", async () => {
    const res = await request(t.app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", checks: { db: "ok" } });
  });

  it("does not require authentication", async () => {
    const res = await request(t.app).get("/health");
    expect(res.status).not.toBe(401);
  });

  it("reports degraded with a 503 when the database is unreachable", async () => {
    // A port nothing listens on: the pool fails to connect and the check trips.
    const broken = createTestApp({ databaseUrl: "postgres://ledger:ledger@127.0.0.1:1/nope" });
    try {
      const res = await request(broken.app).get("/health");

      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: "degraded", checks: { db: "unhealthy" } });
    } finally {
      await broken.close();
    }
  });
});
