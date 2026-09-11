import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import { ApiError } from "./ApiError";

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      throw new ApiError(400, message);
    }
    req.body = result.data;
    next();
  };
}

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  profileImage: z.string().url().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createRoomSchema = z.object({
  name: z.string().min(2).max(120),
});

export const livekitTokenSchema = z.object({
  roomName: z.string().min(1),
  role: z.enum(["host", "participant"]).optional().default("participant"),
});
