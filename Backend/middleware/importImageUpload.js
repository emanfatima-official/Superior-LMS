const multer =
  require("multer");

const MAX_FILES_PER_REQUEST =
  20;

const MAX_FILE_SIZE =
  3 * 1024 * 1024;

const ALLOWED_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

const uploader =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      files:
        MAX_FILES_PER_REQUEST,

      fileSize:
        MAX_FILE_SIZE,
    },

    fileFilter: (
      _req,
      file,
      callback
    ) => {
      const fileType =
        String(
          file.mimetype ||
            ""
        ).toLowerCase();

      if (
        !ALLOWED_TYPES.has(
          fileType
        )
      ) {
        return callback(
          new Error(
            "Only JPG, JPEG, PNG and WEBP profile images are allowed."
          )
        );
      }

      return callback(
        null,
        true
      );
    },
  }).array(
    "images",
    MAX_FILES_PER_REQUEST
  );

// ======================================================
// GENERIC BULK PROFILE IMAGE UPLOAD MIDDLEWARE
// ======================================================

const importImageUpload =
  (
    req,
    res,
    next
  ) => {
    uploader(
      req,
      res,
      (error) => {
        if (!error) {
          return next();
        }

        if (
          error instanceof
          multer.MulterError
        ) {
          const message =
            error.code ===
            "LIMIT_FILE_SIZE"
              ? "Each profile image must be 3 MB or smaller."
              : error.code ===
                  "LIMIT_FILE_COUNT"
                ? `Upload no more than ${MAX_FILES_PER_REQUEST} images in one request.`
                : error.message;

          return res
            .status(400)
            .json({
              success:
                false,

              message,
            });
        }

        return res
          .status(400)
          .json({
            success: false,

            message:
              error.message ||
              "Profile images could not be uploaded.",
          });
      }
    );
  };

module.exports =
  importImageUpload;