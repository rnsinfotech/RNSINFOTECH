
const createApp = require("./src/app");
const { connectDB } = require("./src/config/db");
const { env, assertEnv } = require("./src/config/env");
const { attachSocket, stopChatChangeStream } = require("./src/socket");
const logger = require("./src/utils/logger");
const { startEmailQueue } = require("./src/services/emailTemplates.service");

async function main() {
  assertEnv();
  await connectDB();

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`[admin-backend] listening on :${env.port} (${env.nodeEnv})`);
  });

  attachSocket(server);
  const emailQueue = startEmailQueue();

  const shutdown = (signal) => {
    logger.info(`[admin-backend] received ${signal}, shutting down`);
    clearInterval(emailQueue);
    stopChatChangeStream();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[admin-backend] fatal startup error:", err);
  process.exit(1);
});
