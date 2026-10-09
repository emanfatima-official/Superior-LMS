const router =
  require(
    "express"
  ).Router();

const authenticateAdmin =
  require(
    "../middleware/auth.middleware"
  );

const controller =
  require(
    "../controllers/attendance.controller"
  );

router.use(
  authenticateAdmin
);

// ======================================================
// ATTENDANCE REPORTING
// ======================================================

router.get(
  "/options",
  controller.options
);

router.get(
  "/overview",
  controller.overview
);

router.get(
  "/semester",
  controller.semester
);

router.get(
  "/course",
  controller.course
);

router.get(
  "/student",
  controller.student
);

router.get(
  "/sessions",
  controller.sessions
);

router.get(
  "/export",
  controller.exportData
);

module.exports =
  router;