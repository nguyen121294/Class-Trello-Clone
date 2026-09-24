import { z } from "zod";

const password = z.string().min(8, "Password must be at least 8 characters").max(128);

export const registerSchema = z.object({
  email: z.string().email(),
  password,
  name: z.string().min(1).max(120).optional(),
});

export const registerOrgSchema = z.object({
  orgName: z.string().min(2, "Tên công ty phải có ít nhất 2 ký tự").max(100),
  orgCode: z
    .string()
    .min(2, "Mã công ty phải có từ 2 đến 32 ký tự")
    .max(32)
    .regex(/^[a-z0-9-]+$/, "Mã công ty chỉ gồm chữ thường không dấu, số và dấu gạch ngang (VD: achau, smartlog)"),
  name: z.string().min(1, "Vui lòng nhập họ tên người quản trị").max(120),
  username: z
    .string()
    .min(2, "Username phải có ít nhất 2 ký tự")
    .max(32)
    .regex(/^[a-z0-9_.-]+$/, "Username chỉ gồm chữ thường không dấu, số, dấu chấm hoặc gạch dưới (VD: admin)"),
  password,
});

export const loginSchema = z.object({
  email: z.string().min(1, "Vui lòng nhập tên đăng nhập hoặc email"),
  password: z.string().min(1),
});

export const setupSchema = z.object({
  email: z.string().email(),
  password,
  name: z.string().min(1).max(120),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: password,
});
