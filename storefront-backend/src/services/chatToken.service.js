const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { env } = require("../config/env");
const AUDIENCE = "storefront-chat-guest";
const TTL = "30d";
function signGuestChatToken(threadId) {
  return jwt.sign({ threadId, type: "guest-chat" }, env.jwtAccessSecret, { audience: AUDIENCE, expiresIn: TTL, jwtid: crypto.randomUUID() });
}
function verifyGuestChatToken(token) { return jwt.verify(token, env.jwtAccessSecret, { audience: AUDIENCE }); }
module.exports = { signGuestChatToken, verifyGuestChatToken };
