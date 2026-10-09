const router = require("express").Router();
const authenticateAdmin = require("../middleware/auth.middleware");
const controller = require("../controllers/promotion.controller");

router.use(authenticateAdmin);
router.post("/bulk", controller.promoteStudentsBulk);
router.post("/student/:id", controller.promoteStudent);

module.exports = router;
