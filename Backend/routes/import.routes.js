const {
  createImportController,
} = require(
  "../controllers/import.controller"
);

const authenticateAdmin =
  require(
    "../middleware/auth.middleware"
  );

const importImageUpload =
  require(
    "../middleware/importImageUpload"
  );

// ======================================================
// REGISTER GENERIC IMPORT ROUTES
// ======================================================
// Important:
// In the resource route file, call this function before
// dynamic routes such as "/:id".
// ======================================================

const registerImportRoutes =
  (
    router,
    importType
  ) => {
    const controller =
      createImportController(
        importType
      );

    // Validate parsed rows without creating accounts
    router.post(
      "/import/validate",
      authenticateAdmin,
      controller.validate
    );

    // Create valid accounts
    router.post(
      "/import/commit",
      authenticateAdmin,
      controller.commit
    );

    // Register image import only when the selected
    // importer supports profile-image uploads.
    if (
      controller.images
    ) {
      router.post(
        "/import/images",
        authenticateAdmin,
        importImageUpload,
        controller.images
      );
    }

    return router;
  };

module.exports =
  registerImportRoutes;