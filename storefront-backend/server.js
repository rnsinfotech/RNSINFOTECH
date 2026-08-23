const dns = require("dns");
// Node 17+ defaults DNS lookups to "verbatim" ordering, which returns
// whichever address family the resolver hands back first — on hosts like
// Render's containers that advertise an AAAA (IPv6) record for
// smtp.gmail.com but don't actually have working IPv6 egress, this makes
// outbound SMTP connections fail immediately with ENETUNREACH. Forcing
// ipv4first here (Node 18+) makes DNS resolution consistently prefer IPv4,
// which is what the network here can actually route.
dns.setDefaultResultOrder("ipv4first");

const createApp = require("./src/app");
const { connectDB } = require("./src/config/db");
const { env, assertEnv } = require("./src/config/env");
const { attachSocket, stopChatChangeStream } = require("./src/socket");
const logger = require("./src/utils/logger");
const { startEmailQueue } = require("./src/services/emailTemplates.service");
const { startReservationSweeper } = require("./src/services/stock.service");
const { startCouponSweeper } = require("./src/services/coupon.service");
const { startPaymentReconciliation } = require("./src/services/paymentReconciliation.service");

async function main() {
  assertEnv();
  await connectDB();

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`[storefront-backend] listening on :${env.port} (${env.nodeEnv})`);
  });

  attachSocket(server);
  const emailQueue = startEmailQueue();
  const reservationSweep = await startReservationSweeper();
  const couponSweep = await startCouponSweeper();
  const paymentReconcile = startPaymentReconciliation();

  const shutdown = (signal) => {
    logger.info(`[storefront-backend] received ${signal}, shutting down`);
    clearInterval(reservationSweep);
    clearInterval(couponSweep);
    clearInterval(emailQueue);
    clearInterval(paymentReconcile);
    stopChatChangeStream();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[storefront-backend] fatal startup error:", err);
  process.exit(1);
});