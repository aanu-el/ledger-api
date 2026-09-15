import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { problems, type FieldError } from "../problem.js";

/**
 * Checks the request against Zod schemas before the route runs.
 *
 * Usage in a route:
 *
 *   const createAccountBody = z.object({ currency: z.string() });
 *   type CreateAccountBody = z.infer<typeof createAccountBody>;
 *
 *   router.post("/accounts", validate({ body: createAccountBody }), (req, res) => {
 *     const body = res.locals.body as CreateAccountBody;
 *     ...
 *   });
 *
 * All three parts (body, query, params) are checked before failing, so a bad
 * request reports every problem in one response. Parsed values are stored on
 * `res.locals` rather than written back to `req`, because Express 5 makes
 * `req.query` read-only.
 */
export function validate(schemas: {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}): RequestHandler {
  return (req, res, next) => {
    const errors: FieldError[] = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (result.success) res.locals.body = result.data;
      else errors.push(...toFieldErrors("body", result.error.issues));
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (result.success) res.locals.query = result.data;
      else errors.push(...toFieldErrors("query", result.error.issues));
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (result.success) res.locals.params = result.data;
      else errors.push(...toFieldErrors("params", result.error.issues));
    }

    if (errors.length > 0) {
      next(problems.validation(errors));
      return;
    }
    next();
  };
}

function toFieldErrors(
  part: "body" | "query" | "params",
  issues: { path: PropertyKey[]; message: string }[],
): FieldError[] {
  return issues.map((issue) => ({
    path: [part, ...issue.path.map(String)].join("."),
    message: issue.message,
  }));
}
