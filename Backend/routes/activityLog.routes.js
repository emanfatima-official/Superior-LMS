const express = require("express");

const {
  getActivityLogs,
} = require("../controllers/activityLog.controller");

const authenticateAdmin =
  require("../middleware/auth.middleware");

const router = express.Router();

router.get(
  "/",
  authenticateAdmin,
  getActivityLogs
);

module.exports = router;