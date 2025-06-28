import { z } from "zod";
import {
  userNameSchema,
  emailSchema,
  passwordSchema,
} from "@/app/_types/CommonSchemas";

export const signupRequestSchema = z.object({
  name: userNameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: passwordSchema, // 確認用パスワードフィールドを追加
}).refine((data) => data.password === data.confirmPassword, { // パスワードの一致を検証
  message: "パスワードと確認用パスワードが一致しません",
  path: ["confirmPassword"], // エラーメッセージのパス
});

export type SignupRequest = z.infer<typeof signupRequestSchema>;