const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const HASH_ROUNDS = 10;

function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}
function hashCode(code) { return bcrypt.hash(code, HASH_ROUNDS); }
function compareCode(code, hash) { return bcrypt.compare(code, hash); }
module.exports = { generateCode, hashCode, compareCode };
