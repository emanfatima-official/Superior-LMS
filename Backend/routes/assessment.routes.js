const router =
  require("express").Router();

const authenticateAdmin =
  require("../middleware/auth.middleware");

const controller =
  require("../controllers/assessment.controller");

router.use(
  authenticateAdmin
);

router.get(
  "/course-options",
  controller.courseOptions
);

router.post(
  "/preview",
  controller.preview
);

router.get(
  "/reports/options",
  controller.reportOptions
);

router.get(
  "/reports/results",
  controller.resultsReport
);

router.get(
  "/",
  controller.getAll
);

router.post(
  "/",
  controller.create
);

router.get(
  "/:id",
  controller.getById
);

router.put(
  "/:id",
  controller.update
);

router.delete(
  "/:id",
  controller.remove
);

router.post(
  "/:id/publish",
  controller.publish
);

router.post(
  "/:id/cancel",
  controller.cancel
);

module.exports = router;