import { z } from "zod";
import { emailSchema, passwordSchema } from "./CommonSchemas";

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// rememberMe フィールドをオプションとして追加
export type LoginRequest = z.infer<typeof loginRequestSchema> & {
  rememberMe?: boolean;
};