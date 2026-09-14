import type { ErrorRequestHandler, RequestHandler } from "express";
import { ProblemError, problems } from "../problem.js";

export const PROBLEM_CONTENT_TYPE = "application/problem+json";

/** Terminal 404 for anything no router claimed. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(problems.notFound(`No route for ${req.method} ${req.path}`));
};

/**
 * Single exit for all errors. Known ProblemErrors are serialised as-is;
 * anything else is a bug: logged with its stack, returned as an opaque 500.
 */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  const problem =
    err instanceof ProblemError
      ? err
      : isBodyParseError(err)
        ? problems.validation([{ path: "body", message: "Malformed JSON body" }])
        : problems.internal();

  if (problem.status >= 500) {
    req.log.error({ err }, "unhandled error");
  }

  res.status(problem.status).type(PROBLEM_CONTENT_TYPE).json(problem.toProblem(req.id));
};

function isBodyParseError(err: unknown): boolean {
  return (
    typeof err === "object" && err !== null && "type" in err && err.type === "entity.parse.failed"
  );
}
