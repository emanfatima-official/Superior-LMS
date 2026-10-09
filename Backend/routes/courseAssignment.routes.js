const router = require("express").Router();
const authenticateAdmin = require("../middleware/auth.middleware");
const controller = require("../controllers/courseAssignment.controller");

router.use(authenticateAdmin);

router.get("/teacher-options", controller.teacherOptions);
router.get("/", controller.getAll);
router.get("/:id/history", controller.teacherHistory);
router.get("/:id", controller.getById);
router.post("/", controller.create);
router.put("/:id/teacher", controller.replaceTeacher);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
