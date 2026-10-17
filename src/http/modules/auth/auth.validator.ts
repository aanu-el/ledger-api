import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(1).max(64),
  email: z.email().transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const signinSchema = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128),
});
export type SigninInput = z.infer<typeof signinSchema>;

export const createAPIKeySchema = z.object({
  name: z.string().min(1).max(64),
});
export type CreateAPIKeyInput = z.infer<typeof createAPIKeySchema>;
