const ChatThread = require("../models/ChatThread");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const unreadExpression = {
  $size: {
    $filter: {
      input: "$messages",
      as: "message",
      cond: {
        $and: [
          { $eq: ["$$message.from", "customer"] },
          { $eq: ["$$message.readByAdmin", false] },
        ],
      },
    },
  },
};

const listThreads = asyncHandler(async (req, res) => {
  const { q = "" } = req.query;
  const query = String(q).trim();
  const match = query
    ? {
        $or: [
          { customerName: { $regex: query, $options: "i" } },
          { customerEmail: { $regex: query, $options: "i" } },
          { "messages.text": { $regex: query, $options: "i" } },
        ],
      }
    : {};

  const items = await ChatThread.aggregate([
    { $match: match },
    { $sort: { updatedAt: -1 } },
    { $limit: 100 },
    {
      $project: {
        threadId: 1,
        customerName: 1,
        customerEmail: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        last: { $arrayElemAt: ["$messages", -1] },
        unread: unreadExpression,
      },
    },
  ]);

  res.json({ items });
});

const getThread = asyncHandler(async (req, res) => {
  const thread = await ChatThread.findOne({ threadId: req.params.threadId }).lean();
  if (!thread) throw ApiError.notFound("Chat thread not found.");
  res.json({ thread });
});

const getStats = asyncHandler(async (req, res) => {
  const [summary] = await ChatThread.aggregate([
    {
      $project: {
        status: 1,
        unreadCount: unreadExpression,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unreadThreads: {
          $sum: { $cond: [{ $gt: ["$unreadCount", 0] }, 1, 0] },
        },
        totalUnread: { $sum: "$unreadCount" },
        resolved: {
          $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] },
        },
      },
    },
  ]);

  res.json({
    stats: {
      total: summary?.total || 0,
      unreadThreads: summary?.unreadThreads || 0,
      totalUnread: summary?.totalUnread || 0,
      resolved: summary?.resolved || 0,
    },
  });
});

const appendMessage = asyncHandler(async (req, res) => {
  const text = String(req.body.text || "").trim();
  const clientMessageId = req.body.clientMessageId || null;
  if (!text) throw ApiError.badRequest("Message text is required.");

  if (clientMessageId) {
    const existing = await ChatThread.findOne({ threadId: req.params.threadId, "messages.clientMessageId": clientMessageId });
    if (existing) {
      res.status(200).json({ thread: existing });
      return;
    }
  }

  const message = {
    from: "admin",
    text,
    clientMessageId,
    ts: new Date(),
    readByCustomer: false,
    readByAdmin: true,
  };
  let thread = await ChatThread.findOneAndUpdate(
    { threadId: req.params.threadId, status: "open" },
    { $push: { messages: message }, $set: { updatedAt: new Date() } },
    { new: true, runValidators: true }
  );
  if (thread === undefined) {
    thread = await ChatThread.findOne({ threadId: req.params.threadId });
    if (!thread) throw ApiError.notFound("Chat thread not found or closed.");
    thread.messages.push(message);
    thread.updatedAt = new Date();
    await thread.save();
  }
  if (!thread) throw ApiError.notFound("Chat thread not found or closed.");
  res.status(201).json({ thread });
});

const markRead = asyncHandler(async (req, res) => {
  const thread = await ChatThread.findOneAndUpdate(
    { threadId: req.params.threadId },
    { $set: { "messages.$[m].readByAdmin": true } },
    { new: true, arrayFilters: [{ "m.from": "customer" }] }
  );
  if (!thread) throw ApiError.notFound("Chat thread not found.");
  res.json({ thread });
});

module.exports = { listThreads, getThread, getStats, appendMessage, markRead };
