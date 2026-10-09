const express = require("express");

const {
  createEnrollment,
  bulkEnrollStudents,
  getAllEnrollments,
  getStudentEnrollments,
  getCourseEnrollments,
  updateEnrollment,
  deleteEnrollment,
} = require("../controllers/enrollment.controller");

const authenticateAdmin = require("../middleware/auth.middleware");

const router = express.Router();

// ======================================================
// ENROLL SINGLE STUDENT
// ======================================================

router.post(
  "/",
  authenticateAdmin,
  createEnrollment
);

// ======================================================
// ENROLL MULTIPLE STUDENTS
// ======================================================

router.post(
  "/bulk",
  authenticateAdmin,
  bulkEnrollStudents
);

// ======================================================
// GET ALL ENROLLMENTS
// ======================================================

router.get(
  "/",
  authenticateAdmin,
  getAllEnrollments
);

// ======================================================
// GET STUDENT ENROLLMENTS
// ======================================================

router.get(
  "/student/:student_id",
  authenticateAdmin,
  getStudentEnrollments
);

// ======================================================
// GET COURSE ENROLLMENTS
// IMPORTANT: This must come BEFORE /:id
// ======================================================

router.get(
  "/course/:course_id",
  authenticateAdmin,
  getCourseEnrollments
);

// ======================================================
// UPDATE ENROLLMENT
// ======================================================

router.put(
  "/:id",
  authenticateAdmin,
  updateEnrollment
);

// ======================================================
// DELETE / UNENROLL
// ======================================================

router.delete(
  "/:id",
  authenticateAdmin,
  deleteEnrollment
);

module.exports = router;