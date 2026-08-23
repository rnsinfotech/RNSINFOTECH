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

module.exports = {
  single: (field) => wrap(multerInstance.single(field)),
  array: (field, maxCount) => wrap(multerInstance.array(field, maxCount)),
};
