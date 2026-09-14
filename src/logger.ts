import pino, { type Logger } from "pino";

export type { Logger };

export function createLogger(opts: { level: string; pretty?: boolean }): Logger {
  return pino({
    level: opts.level,
    // Structured JSON in every environment except an interactive dev shell.
    ...(opts.pretty ? { transport: { target: "pino-pretty", options: { colorize: true } } } : {}),
    redact: ["req.headers.authorization"],
  });
}
