import z from "zod";

const metadata = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

export const createAPIKeySchema = z.object({
  name: z.string().min(1).max(64),
  expiresAt: z.coerce
    .date()
    .refine((d) => d > new Date(), "Must be in the future")
    .optional(),
  metadata: metadata.optional(),
});
export type CreateAPIKeyInput = z.infer<typeof createAPIKeySchema>;

export const updateAPIKeySchema = z.object({
  name: z.string().min(1).max(64),
});
export type UpdateAPIKeyInput = z.infer<typeof updateAPIKeySchema>;

export const apiKeyParamsSchema = z.object({
  id: z.string(),
});
