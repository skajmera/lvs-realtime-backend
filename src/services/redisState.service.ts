import { getRedis } from "../config/redis";

// Redis holds the *ephemeral, high-churn* room/presence state — who is
// online, who is in which room right now. MongoDB stays the durable
// system of record (User.isOnline, Room.participants, ParticipantLog),
// but every join/leave/heartbeat would otherwise mean a disk-backed write
// on every socket event; Redis absorbs that at in-memory speed instead,
// and its native pub/sub is what the Socket.IO Redis adapter (see
// src/sockets/index.ts) rides on to broadcast correctly across multiple
// server instances — the "Socket Scaling" use case the assignment calls
// out explicitly.

const ONLINE_SET = "presence:online";
const roomParticipantsKey = (roomId: string) => `room:${roomId}:participants`;

export async function markOnline(userId: string): Promise<void> {
  await getRedis().sadd(ONLINE_SET, userId);
}

export async function markOffline(userId: string): Promise<void> {
  await getRedis().srem(ONLINE_SET, userId);
}

export async function isOnline(userId: string): Promise<boolean> {
  const result = await getRedis().sismember(ONLINE_SET, userId);
  return result === 1;
}

export async function getOnlineUserIds(): Promise<string[]> {
  return getRedis().smembers(ONLINE_SET);
}

export async function addRoomParticipant(roomId: string, userId: string): Promise<number> {
  const redis = getRedis();
  await redis.sadd(roomParticipantsKey(roomId), userId);
  return redis.scard(roomParticipantsKey(roomId));
}

export async function removeRoomParticipant(roomId: string, userId: string): Promise<number> {
  const redis = getRedis();
  await redis.srem(roomParticipantsKey(roomId), userId);
  return redis.scard(roomParticipantsKey(roomId));
}

export async function getRoomParticipants(roomId: string): Promise<string[]> {
  return getRedis().smembers(roomParticipantsKey(roomId));
}

export async function getRoomParticipantCount(roomId: string): Promise<number> {
  return getRedis().scard(roomParticipantsKey(roomId));
}

export async function clearRoomParticipants(roomId: string): Promise<void> {
  await getRedis().del(roomParticipantsKey(roomId));
}
