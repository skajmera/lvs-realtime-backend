import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { registerUser, loginUser, getUserById } from "../services/auth.service";
import { serializeUser } from "../utils/serializers";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { user, token } = await registerUser(req.body);
  res.status(201).json({ user: serializeUser(user), token });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { user, token } = await loginUser(email, password);
  res.status(200).json({ user: serializeUser(user), token });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await getUserById(req.user!.userId);
  res.status(200).json({ user: serializeUser(user) });
});
