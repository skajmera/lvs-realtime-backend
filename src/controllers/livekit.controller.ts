import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { createLiveKitToken } from "../services/livekit.service";

export const getToken = asyncHandler(async (req: Request, res: Response) => {
  const { roomName, role } = req.body;
  const result = await createLiveKitToken(req.user!.userId, roomName, role);
  res.status(200).json(result);
});
