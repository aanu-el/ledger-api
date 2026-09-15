import { describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import { z } from "zod";
import pino from "pino";
import { validate } from "../src/http/middleware/validate.js";
import { requestId } from "../src/http/middleware/request-id.js";
import { errorHandler } from "../src/http/middleware/error-handler.js";

/**
 * The validation middleware composed with the same request-id and error
 * handling the real app uses, on a probe route. Every real route later inherits
 * exactly this behaviour.
 */
describe("validate middleware", () => {
  const bodySchema = z.object({
    amount: z.string().regex(/^\d+$/),
    note: z.string().max(5).optional(),
  });
  const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });
  type Body = z.infer<typeof bodySchema>;
  type Query = z.infer<typeof querySchema>;

  const app = express();
  app.use(requestId);
  app.use((req, _res, next) => {
    req.log = pino({ level: "silent" });
    next();
  });
  app.use(express.json());
  app.post("/_probe", validate({ body: bodySchema, query: querySchema }), (_req, res) => {
    const body = res.locals.body as Body;
    const query = res.locals.query as Query;
    res.json({ body, query });
  });
  app.use(errorHandler);

  it("passes coerced, typed input through to the handler", async () => {
    const res = await request(app).post("/_probe?limit=5").send({ amount: "100" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ body: { amount: "100" }, query: { limit: 5 } });
  });

  it("lists every invalid field across body and query in one response", async () => {
    const res = await request(app).post("/_probe?limit=0").send({ amount: "abc", note: "toolong" });

    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(res.body.type).toBe("urn:ledger:problem:validation-failed");
    const paths = (res.body.errors as { path: string }[]).map((e) => e.path).sort();
    expect(paths).toEqual(["body.amount", "body.note", "query.limit"]);
  });
});
