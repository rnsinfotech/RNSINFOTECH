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

function uploadBuffer(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "image" }, (err, result) => {
      if (err) return reject(err);
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
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

module.exports = { uploadBuffer, destroyImage };
