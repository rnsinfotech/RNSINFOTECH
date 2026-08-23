const ApiError = require("../utils/ApiError");

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MIN_WIDTH = 100;
const MIN_HEIGHT = 100;
const MAX_WIDTH = 6000;
const MAX_HEIGHT = 6000;
const MAX_PIXELS = 25_000_000;

function u32le(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function u24le(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function detectMime(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (buffer.length >= 6 && (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a")) return "image/gif";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

function parsePng(buffer) {
  if (buffer.length < 24 || buffer.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function parseGif(buffer) {
  if (buffer.length < 10) return null;
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

function parseWebp(buffer) {
  if (buffer.length < 30) return null;
  const chunk = buffer.subarray(12, 16).toString("ascii");
  if (chunk === "VP8X") {
    return { width: u24le(buffer, 24) + 1, height: u24le(buffer, 27) + 1 };
  }
  if (chunk === "VP8 ") {
    const start = buffer.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
    if (start < 0 || start + 7 > buffer.length) return null;
    return { width: buffer.readUInt16LE(start + 3) & 0x3fff, height: buffer.readUInt16LE(start + 5) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (buffer[20] !== 0x2f || buffer.length < 25) return null;
    const b1 = buffer[21], b2 = buffer[22], b3 = buffer[23], b4 = buffer[24];
    return { width: 1 + (((b2 & 0x3f) << 8) | b1), height: 1 + (((b4 & 0xf) << 10) | (b3 << 2) | ((b2 >> 6) & 0x3)) };
  }
  return null;
}

function parseJpeg(buffer) {
  if (buffer.length < 4) return null;
  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) break;
    const marker = buffer[offset++];
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 1 >= buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    const isSof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (isSof && length >= 7) return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
    offset += length;
  }
  return null;
}

function readDimensions(buffer, mime) {
  if (mime === "image/png") return parsePng(buffer);
  if (mime === "image/jpeg") return parseJpeg(buffer);
  if (mime === "image/gif") return parseGif(buffer);
  if (mime === "image/webp") return parseWebp(buffer);
  return null;
}

function validateImageFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) throw ApiError.badRequest("A valid image file is required.");
  if (file.size > MAX_FILE_SIZE_BYTES) throw ApiError.badRequest("Image files must be 5 MB or smaller.");
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) throw ApiError.badRequest("Only JPEG, PNG, WEBP, or GIF images are allowed.");

  const detectedMime = detectMime(file.buffer);
  if (!detectedMime || detectedMime !== file.mimetype) {
    throw ApiError.badRequest("The uploaded file is not a valid image or its MIME type does not match its contents.");
  }

  const dimensions = readDimensions(file.buffer, detectedMime);
  if (!dimensions || !Number.isInteger(dimensions.width) || !Number.isInteger(dimensions.height)) {
    throw ApiError.badRequest("The uploaded image has invalid or unreadable dimensions.");
  }
  if (dimensions.width < MIN_WIDTH || dimensions.height < MIN_HEIGHT) {
    throw ApiError.badRequest(`Images must be at least ${MIN_WIDTH}×${MIN_HEIGHT} pixels.`);
  }
  if (dimensions.width > MAX_WIDTH || dimensions.height > MAX_HEIGHT || dimensions.width * dimensions.height > MAX_PIXELS) {
    throw ApiError.badRequest(`Images must be no larger than ${MAX_WIDTH}×${MAX_HEIGHT} pixels and 25 megapixels.`);
  }

  return { mime: detectedMime, width: dimensions.width, height: dimensions.height };
}

module.exports = { validateImageFile, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MIN_WIDTH, MIN_HEIGHT, MAX_WIDTH, MAX_HEIGHT, MAX_PIXELS };
