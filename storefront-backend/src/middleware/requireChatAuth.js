const ApiError = require("../utils/ApiError");
const { verifyAccessToken } = require("../services/token.service");
const { verifyGuestChatToken } = require("../services/chatToken.service");

function requireChatAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (header) {
    const [scheme, token] = header.split(" ");
    if (scheme === "Bearer" && token) {
      try {
        const payload = verifyAccessToken(token);
        req.chatAuth = { type: "customer", userId: payload.sub };
        return next();
      } catch (_) {}
    }
  }
  const guestToken = req.headers["x-chat-token"];
  if (guestToken) {
    try {
      const payload = verifyGuestChatToken(String(guestToken));
      req.chatAuth = { type: "guest", threadId: payload.threadId };
      return next();
    } catch (_) {}
  }
  return next(ApiError.unauthorized("Chat authentication is required."));
}
module.exports = requireChatAuth;
