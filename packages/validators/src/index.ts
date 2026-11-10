import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("กรุณากรอกอีเมลที่ถูกต้อง"),
  password: z.string().min(6, "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร")
});

export const RegisterSchema = z.object({
  name: z.string().min(2, "ชื่อต้องมีความยาวอย่างน้อย 2 ตัวอักษร").max(50),
  email: z.string().email("กรุณากรอกอีเมลที่ถูกต้อง"),
  password: z.string().min(6, "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร")
});

export const CreateRoomSchema = z.object({
  name: z.string().min(2, "ชื่อห้องต้องมีความยาวอย่างน้อย 2 ตัวอักษร").max(80),
  customCode: z
    .string()
    .regex(/^[A-Za-z0-9-]{4,10}$/, "รหัสห้องต้องประกอบด้วยตัวอักษรหรือตัวเลข 4-10 ตัว")
    .optional()
    .or(z.literal("")),
  password: z.string().max(32).optional()
});

export const JoinRoomSchema = z.object({
  code: z
    .string()
    .min(4, "รหัสห้องไม่ถูกต้อง")
    .transform((val) => val.toUpperCase().replace(/\s+/g, "")),
  displayName: z
    .string()
    .min(2, "กรุณากรอกชื่อแสดงตนอย่างน้อย 2 ตัวอักษร")
    .max(40)
    .optional()
    .default("Guest"),
  password: z.string().optional()
});

export const ScreenShareConfigSchema = z.object({
  frameRate: z.number().min(5).max(60).default(30),
  resolution: z.enum(["720p", "1080p", "4k"]).default("1080p"),
  includeAudio: z.boolean().default(true),
  displaySurface: z.enum(["monitor", "window", "browser"]).optional()
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type JoinRoomInput = z.infer<typeof JoinRoomSchema>;
export type ScreenShareConfig = z.infer<typeof ScreenShareConfigSchema>;
