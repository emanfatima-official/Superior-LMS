const express =
  require("express");

const router =
  express.Router();

const {
  createTeacher,
  uploadTeacherAvatar,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
  resetTeacherPassword,
} = require(
  "../controllers/teacher.controller"
);

const authenticateAdmin =
  require(
    "../middleware/auth.middleware"
  );

const upload =
  require(
    "../middleware/upload"
  );

const registerImportRoutes =
  require(
    "./import.routes"
  );

// ======================================================
// BULK IMPORT
// ======================================================
// Keep these routes before "/:id" so Express does not
// treat the word "import" as a Teacher ID.
// ======================================================

registerImportRoutes(
  router,
  "teachers"
);

// ======================================================
// GET ALL TEACHERS
// ======================================================

router.get(
  "/",
  authenticateAdmin,
  getAllTeachers
);

// ======================================================
// CREATE TEACHER
// ======================================================

router.post(
  "/",
  authenticateAdmin,
  createTeacher
);

// ======================================================
// UPLOAD SINGLE TEACHER AVATAR
// ======================================================
// This existing route is separate from bulk image import.
// Keep it before "/:id".
// ======================================================

router.post(
  "/avatar",
  authenticateAdmin,
  upload.single(
    "avatar"
  ),
  uploadTeacherAvatar
);

// ======================================================
// RESET TEACHER PASSWORD
// ======================================================

router.patch(
  "/:id/password",
  authenticateAdmin,
  resetTeacherPassword
);

// ======================================================
// GET TEACHER BY ID
// ======================================================

router.get(
  "/:id",
  authenticateAdmin,
  getTeacherById
);

// ======================================================
// UPDATE TEACHER
// ======================================================

router.put(
  "/:id",
  authenticateAdmin,
  updateTeacher
);

// ======================================================
// DELETE TEACHER
// ======================================================

router.delete(
  "/:id",
  authenticateAdmin,
  deleteTeacher
);

module.exports =
  router;