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

module.exports = { uploadBuffer, destroyImage, PRODUCT_IMAGE_TRANSFORM };
