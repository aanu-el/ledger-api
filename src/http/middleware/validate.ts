import type { RequestHandler } from "express";
import { z, type ZodType } from "zod";
import { problems, type FieldError } from "../problem.js";

type Schemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

type Infer<S extends Schemas> = {
  body: S["body"] extends ZodType ? z.output<S["body"]> : undefined;
  query: S["query"] extends ZodType ? z.output<S["query"]> : undefined;
  params: S["params"] extends ZodType ? z.output<S["params"]> : undefined;
};

declare global {
  namespace Express {
    interface Locals {
      input?: unknown;
    }
  }
}

/**
 * Validates body/query/params against Zod schemas. Express 5 makes `req.query`
 * a read-only getter, so the parsed (and coerced) input is placed on
 * `res.locals.input` and read back with `getInput(res)`.
 */
export function validate<S extends Schemas>(schemas: S): RequestHandler {
  return (req, res, next) => {
    const errors: FieldError[] = [];
    const out: Record<string, unknown> = {};

    for (const key of ["body", "query", "params"] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (result.success) {
        out[key] = result.data;
      } else {
        for (const issue of result.error.issues) {
          errors.push({ path: [key, ...issue.path].join("."), message: issue.message });
        }
      }
    }

    if (errors.length > 0) {
      next(problems.validation(errors));
      return;
    }
    res.locals.input = out;
    next();
  };
}

export function getInput<S extends Schemas>(res: { locals: { input?: unknown } }): Infer<S> {
  return res.locals.input as Infer<S>;
}
