import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { getRedis } from "../config/redis";
import { verifyToken } from "../utils/jwt";
import { logger } from "../utils/logger";
import { User } from "../models/User";
import { joinRoom, leaveRoom, getRoomById } from "../services/room.service";
import { markOnline, markOffline, getRoomParticipantCount } from "../services/redisState.service";
import { serializeRoom } from "../utils/serializers";

interface SocketData {
  userId: string;
  rooms: Set<string>;
}

export function initSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  // The Redis adapter is what makes broadcasts correct once there's more
  // than one server instance — without it, "emit to room X" only reaches
  // sockets connected to *this* process. subClient must be a dedicated
  // connection (Redis puts a connection in subscriber mode and it can't
  // also run normal commands), hence the duplicate().
  const pubClient = getRedis();
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error("Missing auth token");
      const payload = verifyToken(token);
      (socket.data as SocketData).userId = payload.userId;
      (socket.data as SocketData).rooms = new Set();
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const { userId } = socket.data as SocketData;
    logger.info(`Socket connected: ${socket.id} (user ${userId})`);

    handleConnect(io, userId).catch((err) => logger.error(`connect handler failed: ${err.message}`));

    socket.on("room:join", async (payload: { roomId: string }, ack?: (res: unknown) => void) => {
      try {
        const room = await joinRoom(payload.roomId, userId);
        socket.join(roomChannel(payload.roomId));
        (socket.data as SocketData).rooms.add(payload.roomId);

        const participantCount = await getRoomParticipantCount(payload.roomId);

        io.to(roomChannel(payload.roomId)).emit("room:participant-joined", {
          roomId: payload.roomId,
          userId,
          participantCount,
        });

        ack?.({ ok: true, room: serializeRoom(room) });
      } catch (err) {
        ack?.({ ok: false, error: err instanceof Error ? err.message : "Failed to join room" });
      }
    });

    socket.on("room:leave", async (payload: { roomId: string }, ack?: (res: unknown) => void) => {
      try {
        await handleLeaveRoom(io, socket, payload.roomId, userId);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err instanceof Error ? err.message : "Failed to leave room" });
      }
    });

    // A generic real-time message/event within a room — chat text, a
    // reaction, a signal for the client's own UI state. Broadcast is
    // scoped to the room's channel only, per the assignment's requirement
    // that events reach just the relevant users.
    socket.on("room:message", (payload: { roomId: string; message: unknown }) => {
      if (!(socket.data as SocketData).rooms.has(payload.roomId)) return; // not a member, ignore
      io.to(roomChannel(payload.roomId)).emit("room:message", {
        roomId: payload.roomId,
        userId,
        message: payload.message,
        sentAt: new Date().toISOString(),
      });
    });

    socket.on("disconnect", async () => {
      logger.info(`Socket disconnected: ${socket.id} (user ${userId})`);
      const roomsToLeave = Array.from((socket.data as SocketData).rooms);
      for (const roomId of roomsToLeave) {
        try {
          await handleLeaveRoom(io, socket, roomId, userId, /* alreadyDisconnected */ true);
        } catch (err) {
          logger.error(`cleanup leave failed for room ${roomId}: ${err instanceof Error ? err.message : err}`);
        }
      }
      await handleDisconnect(io, userId);
    });
  });

  return io;
}

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

async function handleConnect(io: Server, userId: string): Promise<void> {
  await markOnline(userId);
  await User.findByIdAndUpdate(userId, { isOnline: true, lastSeenAt: new Date() });
  io.emit("user:online", { userId });
}

async function handleDisconnect(io: Server, userId: string): Promise<void> {
  await markOffline(userId);
  await User.findByIdAndUpdate(userId, { isOnline: false, lastSeenAt: new Date() });
  io.emit("user:offline", { userId });
}

async function handleLeaveRoom(
  io: Server,
  socket: Socket,
  roomId: string,
  userId: string,
  alreadyDisconnected = false
): Promise<void> {
  const room = await leaveRoom(roomId, userId);
  if (!alreadyDisconnected) {
    socket.leave(roomChannel(roomId));
  }
  (socket.data as SocketData).rooms.delete(roomId);

  const participantCount = await getRoomParticipantCount(roomId);

  io.to(roomChannel(roomId)).emit("room:participant-left", { roomId, userId, participantCount });

  if (room.status === "ended") {
    io.to(roomChannel(roomId)).emit("room:status-update", { roomId, status: "ended" });
  }
}

// Exported for a health-check / debugging endpoint if ever needed.
export async function getRoomSnapshot(roomId: string) {
  const room = await getRoomById(roomId);
  return serializeRoom(room);
}
