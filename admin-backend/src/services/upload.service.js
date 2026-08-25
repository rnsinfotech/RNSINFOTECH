const path = require("path");
const crypto = require("crypto");
const cloudinary = require("cloudinary").v2;
const { env } = require("../config/env");
const logger = require("../utils/logger");

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

// Products/categories only ever hold a Cloudinary { url, publicId } pair
// (see the Product/Category models) — never a raw file path — so both
// functions here are the only place in the app that talks to Cloudinary
// directly. Swapping providers later (e.g. S3) only touches this file.

// Cap stored dimensions and let Cloudinary pick the best format/quality
// per requesting browser (auto WebP/AVIF where supported). Applied at
// upload time — not just as a delivery-time transform — so the stored
// asset itself is never larger than a product photo needs to be,
// regardless of what the original upload was (a 6000px source photo and
// a 2000px one end up costing the same to serve).
const PRODUCT_IMAGE_TRANSFORM = [
  { width: 2000, height: 2000, crop: "limit" },
  { quality: "auto", fetch_format: "auto" },
];

function uploadBuffer(buffer, folder, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image", ...options },
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

// Deleting an old/replaced image is best-effort: an orphaned Cloudinary
// asset costs storage, not correctness, so a failure here should never
// block the DB write that's actually the point of the request.
async function destroyImage(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    logger.warn(`Failed to delete Cloudinary asset ${publicId}: ${err.message}`);
  }
}

// Bills/invoices are PDFs (occasionally a photographed JPEG), not
// photographs to be resized/optimized — stored as-is via Cloudinary's
// "raw" resource type rather than the image pipeline above.
//
// Unlike image/video resources, Cloudinary's "raw" type does NOT append
// a file extension to the delivery URL on its own — it only uses
// whatever extension is baked into the public_id we hand it. Without
// one (the old code passed only `folder`, no public_id), the stored
// asset has no extension, Cloudinary serves it as
// `Content-Type: application/octet-stream`, and browsers can neither
// render it inline nor save it back out as a recognizable .pdf/.jpg —
// which is exactly the "downloads in the wrong format" / "won't open
// in a new tab" bug. Passing originalFilename lets us preserve the
// real extension in the public_id so delivery gets the right
// Content-Type and inline (not forced-attachment) behavior.
function uploadDocumentBuffer(buffer, folder, originalFilename) {
  return new Promise((resolve, reject) => {
    const ext = (originalFilename && path.extname(originalFilename).slice(1).toLowerCase()) || "pdf";
    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "raw", public_id: uniqueName, use_filename: false, unique_filename: false },
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

async function destroyDocument(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
  } catch (err) {
    logger.warn(`Failed to delete Cloudinary document ${publicId}: ${err.message}`);
  }
}

module.exports = { uploadBuffer, destroyImage, uploadDocumentBuffer, destroyDocument, PRODUCT_IMAGE_TRANSFORM };
