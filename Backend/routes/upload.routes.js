const express = require("express");
const router = express.Router();
const authenticateAdmin = require("../middleware/auth.middleware");
const upload = require("../middleware/upload");
const attachmentUpload = require("../middleware/attachmentUpload");
const { uploadAvatar, uploadAnnouncementAttachment } = require("../controllers/upload.controller");

router.use(authenticateAdmin);
router.post("/avatar", upload.single("avatar"), uploadAvatar);
router.post("/announcement-attachment", attachmentUpload.single("attachment"), uploadAnnouncementAttachment);

module.exports = router;
