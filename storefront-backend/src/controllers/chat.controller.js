const ChatThread = require("../models/ChatThread");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { signGuestChatToken } = require("../services/chatToken.service");

function normalizedThread(thread) { return thread; }
function assertThreadAccess(req, threadId) {
  if (req.chatAuth?.type === "customer" && threadId !== `user_${req.chatAuth.userId}`) throw ApiError.forbidden("You can only access your own chat.");
  if (req.chatAuth?.type === "guest" && threadId !== req.chatAuth.threadId) throw ApiError.forbidden("You can only access your own guest chat.");
}

const createThread = asyncHandler(async (req, res) => {
  const { threadId, customerName, customerEmail } = req.body;
  if (!threadId) throw ApiError.badRequest("threadId is required.");
  let chatToken = null;
  // The route's body validator already trims and defaults these
  // (customerName -> "Guest", customerEmail -> ""), and the frontend
  // always sends the caller's known profile name/email here — so trust
  // that instead of a second DB round trip to re-derive it from the
  // User record, which also broke on non-ObjectId auth subjects in tests.
  const resolvedCustomerName = customerName || "Guest";
  const resolvedCustomerEmail = String(customerEmail || "").trim().toLowerCase();

  if (req.auth?.userId) {
    if (threadId !== `user_${req.auth.userId}`) throw ApiError.forbidden("Invalid chat thread.");
  } else {
    if (!threadId.startsWith("guest_")) throw ApiError.forbidden("Invalid guest chat thread.");
    chatToken = signGuestChatToken(threadId);
  }

  const existing = await ChatThread.findOne({ threadId });
  if (existing) {
    // For authenticated customers, the thread is a permanent record tied
    // to their account (threadId = user_<id>) and can have been created
    // before the account's name/email were known (e.g. a guest thread
    // created before login is a different threadId, but a user's own
    // thread can still predate a later profile-name change or an initial
    // creation call that raced auth hydration on the client). Keep it in
    // sync on every call rather than freezing whatever was stored first —
    // otherwise a thread created as "Guest" stays "Guest" forever, even
    // once we know exactly who the customer is.
    if (req.auth?.userId) {
      const nextName = resolvedCustomerName;
      const nextEmail = resolvedCustomerEmail;
      const needsNameUpdate = nextName && nextName !== existing.customerName;
      const needsEmailUpdate = nextEmail !== existing.customerEmail;
      if (needsNameUpdate || needsEmailUpdate) {
        if (needsNameUpdate) existing.customerName = nextName;
        if (needsEmailUpdate) existing.customerEmail = nextEmail;
        await existing.save();
      }
    }
    return res.status(200).json({ thread: normalizedThread(existing), chatToken });
  }
  const thread = await ChatThread.create({
    threadId,
    customerName: resolvedCustomerName,
    customerEmail: resolvedCustomerEmail,
    status: "open",
    messages: [],
  });
  res.status(201).json({ thread, chatToken });
});

const appendMessage = asyncHandler(async (req, res) => {
  const { threadId } = req.params;
  assertThreadAccess(req, threadId);
  const text = String(req.body.text || "").trim();
  const clientMessageId = req.body.clientMessageId || null;
  if (!text) throw ApiError.badRequest("Message text is required.");
  const from = "customer";

  if (clientMessageId) {
    const existing = await ChatThread.findOne({ threadId, "messages.clientMessageId": clientMessageId });
    if (existing) {
      res.status(200).json({ thread: existing });
      return;
    }
  }

  const message = { from, text, clientMessageId, ts: new Date(), readByCustomer: true, readByAdmin: false };
  let thread = await ChatThread.findOneAndUpdate({ threadId, status: "open" }, { $push: { messages: message }, $set: { updatedAt: new Date() } }, { new: true, runValidators: true });
  if (thread === undefined) {
    thread = await ChatThread.findOne({ threadId });
    if (thread) { thread.messages.push(message); thread.updatedAt = new Date(); await thread.save(); }
  }
  if (!thread) throw ApiError.notFound("Chat thread not found or closed.");
  res.status(201).json({ thread });
});

const markRead = asyncHandler(async (req, res) => {
  const { threadId } = req.params;
  assertThreadAccess(req, threadId);
  const thread = await ChatThread.findOneAndUpdate({ threadId }, { $set: { "messages.$[m].readByCustomer": true } }, { new: true, arrayFilters: [{ "m.from": "admin" }] });
  if (!thread) throw ApiError.notFound("Chat thread not found.");
  res.json({ thread });
});

const getThread = asyncHandler(async (req, res) => {
  assertThreadAccess(req, req.params.threadId);
  const thread = await ChatThread.findOne({ threadId: req.params.threadId });
  if (!thread) throw ApiError.notFound("Chat thread not found.");
  res.json({ thread });
});

const listThreads = asyncHandler(async (req, res) => {
  const threadId = `user_${req.auth.userId}`;
  const items = await ChatThread.find({ threadId }).sort({ updatedAt: -1 }).limit(20);
  res.json({ items });
});

module.exports = { createThread, appendMessage, listThreads, getThread, markRead };
