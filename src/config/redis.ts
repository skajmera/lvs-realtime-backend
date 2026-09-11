import Redis from "ioredis";
import { env } from "./env";
import { logger } from "../utils/logger";

// A single shared client, created lazily so tests can swap in
// ioredis-mock (see tests/setup.ts) before any module imports this.
let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    client.on("error", (err) => logger.error(`Redis error: ${err.message}`));
    client.on("connect", () => logger.info("Redis connected"));
  }
  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
