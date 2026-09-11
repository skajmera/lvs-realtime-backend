import { createServer } from "http";
import { createApp } from "./app";
import { connectDB } from "./config/database";
import { getRedis } from "./config/redis";
import { initSocketServer } from "./sockets";
import { env } from "./config/env";
import { logger } from "./utils/logger";

async function bootstrap(): Promise<void> {
  await connectDB();
  getRedis(); // establishes the shared connection early so failures surface at boot, not on first use

  const app = createApp();
  const httpServer = createServer(app);
  initSocketServer(httpServer);

  httpServer.listen(env.port, () => {
    logger.info(`Server listening on port ${env.port} (${env.nodeEnv})`);
  });

  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down");
    httpServer.close(() => process.exit(0));
  });
}

bootstrap().catch((err) => {
  logger.error(`Failed to start server: ${err instanceof Error ? err.stack : err}`);
  process.exit(1);
});
