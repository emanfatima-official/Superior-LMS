const express = require("express");

const courseController = require("../controllers/course.controller");
const authenticateAdmin = require("../middleware/auth.middleware");

const router = express.Router();


// Create Course
router.post("/", authenticateAdmin, courseController.createCourse);


// Get All Courses
router.get("/", authenticateAdmin, courseController.getAllCourses);


// Get Single Course
router.get("/:id", authenticateAdmin, courseController.getCourseById);


// Update Course
router.put("/:id", authenticateAdmin, courseController.updateCourse);


// Delete Course
router.delete("/:id", authenticateAdmin, courseController.deleteCourse);


module.exports = router;