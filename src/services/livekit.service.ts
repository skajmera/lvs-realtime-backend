import { AccessToken } from "livekit-server-sdk";
import { env, isLiveKitConfigured } from "../config/env";
import { ApiError } from "../utils/ApiError";

export interface LiveKitTokenResult {
  token: string;
  serverUrl: string;
  roomName: string;
}

export async function createLiveKitToken(
  userId: string,
  roomName: string,
  role: "host" | "participant"
): Promise<LiveKitTokenResult> {
  if (!isLiveKitConfigured()) {
    throw new ApiError(
      503,
      "LiveKit is not configured on this server (LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_SERVER_URL)"
    );
  }

  const at = new AccessToken(env.livekit.apiKey, env.livekit.apiSecret, {
    identity: userId,
    ttl: "10m",
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    // A host can publish audio/video/screenshare; a plain participant can
    // still publish (this is a group voice/live chat, not a
    // broadcast-only webinar) but only a host can mute/remove others.
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: role === "host",
  });

  const token = await at.toJwt();

  return { token, serverUrl: env.livekit.serverUrl, roomName };
}
