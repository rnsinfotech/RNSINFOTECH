const { Router } = require("express");
const chatController = require("../controllers/chat.controller");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const requireChatAuth = require("../middleware/requireChatAuth");
const validateParamPattern = require("../middleware/validateParamPattern");
const router = Router();

const threadBody = { safeParse: (value) => {
  const body = value || {};
  const threadId = typeof body.threadId === "string" && body.threadId.trim() ? body.threadId.trim() : undefined;
  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "Guest";
  const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim() : "";
  if (!threadId) return { success: false, error: { flatten: () => ({ fieldErrors: { threadId: ["threadId is required."] } }) } };
  return { success: true, data: { threadId, customerName, customerEmail } };
} };

router.post("/threads", (req, res, next) => {
  const header = req.headers.authorization || "";
  if (header) return requireAuth(req, res, next);
  next();
}, validate(threadBody, "body"), chatController.createThread);
router.get("/threads/:threadId", validateParamPattern("threadId", /^[A-Za-z0-9_-]{1,180}$/), requireChatAuth, chatController.getThread);
router.post("/threads/:threadId/messages", validateParamPattern("threadId", /^[A-Za-z0-9_-]{1,180}$/), requireChatAuth, validate({ safeParse: (value) => {
  const text = typeof value?.text === "string" ? value.text.trim() : "";
  const clientMessageId = typeof value?.clientMessageId === "string" ? value.clientMessageId.trim() : "";
  if (!text) return { success: false, error: { flatten: () => ({ fieldErrors: { text: ["text is required."] } }) } };
  if (clientMessageId && !/^[A-Za-z0-9_-]{1,120}$/.test(clientMessageId)) {
    return { success: false, error: { flatten: () => ({ fieldErrors: { clientMessageId: ["clientMessageId is invalid."] } }) } };
  }
  return { success: true, data: { text, clientMessageId: clientMessageId || null } };
} }, "body"), chatController.appendMessage);
router.post("/threads/:threadId/read", validateParamPattern("threadId", /^[A-Za-z0-9_-]{1,180}$/), requireChatAuth, chatController.markRead);
router.get("/threads", requireAuth, chatController.listThreads);
module.exports = router;
