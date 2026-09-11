import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { createRoom, listActiveRooms, getRoomById, joinRoom, leaveRoom } from "../services/room.service";
import { serializeRoom } from "../utils/serializers";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const room = await createRoom(req.user!.userId, req.body.name);
  res.status(201).json({ room: serializeRoom(room) });
});

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const rooms = await listActiveRooms();
  res.status(200).json({ rooms: rooms.map(serializeRoom) });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const room = await getRoomById(req.params.id);
  res.status(200).json({ room: serializeRoom(room) });
});

export const join = asyncHandler(async (req: Request, res: Response) => {
  const room = await joinRoom(req.params.id, req.user!.userId);
  res.status(200).json({ room: serializeRoom(room) });
});

export const leave = asyncHandler(async (req: Request, res: Response) => {
  const room = await leaveRoom(req.params.id, req.user!.userId);
  res.status(200).json({ room: serializeRoom(room) });
});
