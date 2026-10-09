const express = require("express");
const academicController = require("../controllers/academicStructure.controller");
const authenticateAdmin = require("../middleware/auth.middleware");

const router = express.Router();

// ======================================================
// BATCHES
// ======================================================

router.get("/batches", authenticateAdmin, academicController.getBatches);
router.get(
  "/batch-programs",
  authenticateAdmin,
  academicController.getBatchPrograms
);
router.get("/batches/:id", authenticateAdmin, academicController.getBatch);
router.post(
  "/batches",
  authenticateAdmin,
  academicController.createBatch
);
router.put(
  "/batches/:id",
  authenticateAdmin,
  academicController.updateBatch
);
router.delete(
  "/batches/:id",
  authenticateAdmin,
  academicController.deleteBatch
);

// ======================================================
// DEPARTMENTS
// ======================================================

router.get(
  "/departments",
  authenticateAdmin,
  academicController.getDepartments
);
router.get(
  "/departments/:id",
  authenticateAdmin,
  academicController.getDepartment
);
router.post(
  "/departments",
  authenticateAdmin,
  academicController.createDepartment
);
router.put(
  "/departments/:id",
  authenticateAdmin,
  academicController.updateDepartment
);
router.delete(
  "/departments/:id",
  authenticateAdmin,
  academicController.deleteDepartment
);

// ======================================================
// PROGRAMS
// ======================================================

router.get(
  "/programs",
  authenticateAdmin,
  academicController.getPrograms
);
router.get(
  "/programs/:id",
  authenticateAdmin,
  academicController.getProgram
);
router.post(
  "/programs",
  authenticateAdmin,
  academicController.createProgram
);
router.put(
  "/programs/:id",
  authenticateAdmin,
  academicController.updateProgram
);
router.delete(
  "/programs/:id",
  authenticateAdmin,
  academicController.deleteProgram
);

// ======================================================
// SEMESTERS
// ======================================================

router.get(
  "/semesters",
  authenticateAdmin,
  academicController.getSemesters
);

router.get(
  "/semesters/:id",
  authenticateAdmin,
  academicController.getSemester
);

// BULK MUST COME BEFORE /:id style routes where relevant
router.post(
  "/semesters/bulk",
  authenticateAdmin,
  academicController.createSemestersBulk
);

router.post(
  "/semesters",
  authenticateAdmin,
  academicController.createSemester
);

router.put(
  "/semesters/:id",
  authenticateAdmin,
  academicController.updateSemester
);

router.delete(
  "/semesters/:id",
  authenticateAdmin,
  academicController.deleteSemester
);
module.exports = router;
