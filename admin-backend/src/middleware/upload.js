const multer = require("multer");
const ApiError = require("../utils/ApiError");
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, validateImageFile } = require("../services/imageValidation.service");

const MAX_FILES_PER_UPLOAD = 6;

const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES_PER_UPLOAD },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(new ApiError(400, "Only JPEG, PNG, WEBP, or GIF images are allowed."));
    cb(null, true);
  },
});

function wrap(multerMiddleware) {
  return function handleUpload(req, res, next) {
    multerMiddleware(req, res, (err) => {
      if (err) return next(err instanceof ApiError ? err : ApiError.badRequest(err.message || "Upload failed."));
      try {
        const files = req.files || (req.file ? [req.file] : []);
        files.forEach(validateImageFile);
        next();
      } catch (validationError) {
        next(validationError);
      }
    });
  };
}

const BILL_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_BILL_SIZE_BYTES = 10 * 1024 * 1024; // 10MB — plenty for a scanned/printed bill.

const billMulterInstance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BILL_SIZE_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    if (!BILL_MIME_TYPES.has(file.mimetype)) return cb(new ApiError(400, "Only PDF, JPEG, PNG, or WEBP files are allowed for a bill."));
    cb(null, true);
  },
});

// Bills skip the product-photo validation pipeline above (dimension/
// decoding checks that don't apply to a PDF) — just the mimetype/size
// checks multer already did in fileFilter/limits.
function wrapBillUpload(multerMiddleware) {
  return function handleUpload(req, res, next) {
    multerMiddleware(req, res, (err) => {
      if (err) return next(err instanceof ApiError ? err : ApiError.badRequest(err.message || "Upload failed."));
      next();
    });
  };
}

module.exports = {
  single: (field) => wrap(multerInstance.single(field)),
  array: (field, maxCount) => wrap(multerInstance.array(field, maxCount)),
  bill: (field) => wrapBillUpload(billMulterInstance.single(field)),
};
