import { Types } from "mongoose";
import { Room, IRoom } from "../models/Room";
import { ParticipantLog } from "../models/ParticipantLog";
import { ApiError } from "../utils/ApiError";
import { addRoomParticipant, removeRoomParticipant, clearRoomParticipants } from "./redisState.service";

export async function createRoom(hostId: string, name: string): Promise<IRoom> {
  const room = await Room.create({
    name,
    host: new Types.ObjectId(hostId),
    participants: [new Types.ObjectId(hostId)],
    status: "active",
  });

  await ParticipantLog.create({ room: room._id, user: hostId, joinedAt: new Date() });
  await addRoomParticipant(room._id.toString(), hostId);

  return room;
}

export async function listActiveRooms(): Promise<IRoom[]> {
  return Room.find({ status: "active" }).sort({ createdAt: -1 });
}

export async function getRoomById(roomId: string): Promise<IRoom> {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, "Room not found");
  }
  return room;
}

export async function joinRoom(roomId: string, userId: string): Promise<IRoom> {
  const room = await getRoomById(roomId);
  if (room.status !== "active") {
    throw new ApiError(400, "This room has ended");
  }

  const already = room.participants.some((p) => p.toString() === userId);
  if (!already) {
    room.participants.push(new Types.ObjectId(userId));
    await room.save();
    await ParticipantLog.create({ room: room._id, user: userId, joinedAt: new Date() });
  }

  await addRoomParticipant(roomId, userId);
  return room;
}

export async function leaveRoom(roomId: string, userId: string): Promise<IRoom> {
  const room = await getRoomById(roomId);

  room.participants = room.participants.filter((p) => p.toString() !== userId);

  // The host leaving ends the room for everyone rather than leaving a
  // "live" room with no host — simpler and matches how a real
  // livestream/voice-chat host leaving would behave.
  const wasHost = room.host.toString() === userId;
  if (wasHost || room.participants.length === 0) {
    room.status = "ended";
    room.endedAt = new Date();
    await clearRoomParticipants(roomId);
  } else {
    await removeRoomParticipant(roomId, userId);
  }

  await room.save();

  await ParticipantLog.findOneAndUpdate(
    { room: room._id, user: userId, leftAt: { $exists: false } },
    { leftAt: new Date() },
    { sort: { joinedAt: -1 } }
  );

  return room;
}
