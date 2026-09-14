import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

declare module "http" {
  interface IncomingMessage {
    id: string;
  }
}

/**
 * Honour a caller-supplied X-Request-Id (so clients can correlate across
 * services) or mint one. It is echoed on the response and stamped on every
 * log line for the request.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header(REQUEST_ID_HEADER);
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
};
