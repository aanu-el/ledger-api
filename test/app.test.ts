import { describe, expect, it } from "vitest";
import request from "supertest";
import pino from "pino";
import { createApp } from "../src/app.js";
import type { PrismaClient } from "../src/db/prisma.js";

describe("GET /health", () => {
  it("reports ok when the database responds", async () => {
    const db = {
      $queryRaw: () => Promise.resolve([]),
    } as unknown as PrismaClient;
    const app = createApp({ db, logger: pino({ level: "silent" }) });

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
