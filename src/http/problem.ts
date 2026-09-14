/**
 * RFC 9457 Problem Details. Every error the API emits goes through this type so
 * clients can branch on a stable `type` rather than parsing messages.
 */
export const PROBLEM_TYPE_PREFIX = "urn:ledger:problem:";

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  request_id?: string;
  errors?: FieldError[];
}

export interface FieldError {
  path: string;
  message: string;
}

export class ProblemError extends Error {
  readonly type: string;
  readonly status: number;
  readonly title: string;
  readonly detail: string | undefined;
  readonly errors: FieldError[] | undefined;

  constructor(opts: {
    slug: string;
    status: number;
    title: string;
    detail?: string;
    errors?: FieldError[];
  }) {
    super(opts.detail ?? opts.title);
    this.name = "ProblemError";
    this.type = PROBLEM_TYPE_PREFIX + opts.slug;
    this.status = opts.status;
    this.title = opts.title;
    this.detail = opts.detail;
    this.errors = opts.errors;
  }

  toProblem(requestId: string): ProblemDetails {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      ...(this.detail !== undefined ? { detail: this.detail } : {}),
      ...(this.errors !== undefined ? { errors: this.errors } : {}),
      request_id: requestId,
    };
  }
}

export const problems = {
  notFound: (detail?: string) =>
    new ProblemError({
      slug: "not-found",
      status: 404,
      title: "Not Found",
      ...(detail ? { detail } : {}),
    }),
  validation: (errors: FieldError[]) =>
    new ProblemError({
      slug: "validation-failed",
      status: 400,
      title: "Validation Failed",
      detail: "One or more request fields are invalid.",
      errors,
    }),
  internal: () =>
    new ProblemError({ slug: "internal", status: 500, title: "Internal Server Error" }),
};
