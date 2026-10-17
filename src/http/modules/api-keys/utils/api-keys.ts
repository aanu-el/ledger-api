import { randomBytes, createHash } from "node:crypto";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateRawKey() {
  const key = `sk_${randomBytes(32).toString("base64url")}`;
  return { key, prefix: key.slice(0, 11), keyHash: hashApiKey(key) };
}
