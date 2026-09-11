import { IUser } from "../models/User";
import { IRoom } from "../models/Room";

export function serializeUser(user: IUser) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    profileImage: user.profileImage ?? null,
    isOnline: user.isOnline,
    lastSeenAt: user.lastSeenAt ?? null,
  };
}

export function serializeRoom(room: IRoom) {
  return {
    id: room._id.toString(),
    name: room.name,
    host: room.host.toString(),
    participants: room.participants.map((p) => p.toString()),
    participantCount: room.participants.length,
    status: room.status,
    createdAt: room.createdAt,
    endedAt: room.endedAt ?? null,
  };
}
