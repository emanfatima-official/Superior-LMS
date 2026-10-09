const router = require("express").Router();
const authenticateAdmin = require("../middleware/auth.middleware");
const controller = require("../controllers/history.controller");

router.use(authenticateAdmin);
router.get("/students/:id/course-assignments/:courseAssignmentId", controller.studentCourseHistory);
router.get("/students/:id", controller.studentOverview);
router.get("/teachers/:id", controller.teacherHistory);
router.get("/courses/:id", controller.courseHistory);
router.get("/course-assignments/:id", controller.courseAssignmentHistory);

module.exports = router;
