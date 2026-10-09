const express =
  require("express");

const studentController =
  require(
    "../controllers/student.controller"
  );

const authenticateAdmin =
  require(
    "../middleware/auth.middleware"
  );

const registerImportRoutes =
  require(
    "./import.routes"
  );

const router =
  express.Router();

// ======================================================
// BULK IMPORT
// ======================================================
// These routes must remain above "/:id" so Express does
// not treat the word "import" as a Student ID.
// ======================================================

registerImportRoutes(
  router,
  "students"
);

// ======================================================
// CREATE STUDENT
// ======================================================

router.post(
  "/",
  authenticateAdmin,
  studentController.createStudent
);

// ======================================================
// GET ALL STUDENTS
// ======================================================

router.get(
  "/",
  authenticateAdmin,
  studentController.getAllStudents
);

// ======================================================
// UPDATE STUDENT STATUS
// ======================================================
// This route must remain before "/:id".
// ======================================================

router.patch(
  "/:id/status",
  authenticateAdmin,
  studentController.updateStudentStatus
);

// ======================================================
// RESET STUDENT PASSWORD
// ======================================================
// This route must remain before "/:id".
// ======================================================

router.patch(
  "/:id/reset-password",
  authenticateAdmin,
  studentController.resetStudentPassword
);

// ======================================================
// GET SINGLE STUDENT
// ======================================================

router.get(
  "/:id",
  authenticateAdmin,
  studentController.getStudentById
);

// ======================================================
// UPDATE STUDENT
// ======================================================

router.put(
  "/:id",
  authenticateAdmin,
  studentController.updateStudent
);

// ======================================================
// DELETE STUDENT
// ======================================================

router.delete(
  "/:id",
  authenticateAdmin,
  studentController.deleteStudent
);

module.exports =
  router;