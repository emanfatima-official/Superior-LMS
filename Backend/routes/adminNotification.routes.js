const router = require('express').Router();
const authenticateAdmin = require('../middleware/auth.middleware');
const controller = require('../controllers/adminNotification.controller');

router.use(authenticateAdmin);
router.get('/announcements', controller.listAnnouncements);
router.post('/announcements', controller.createAnnouncement);

module.exports = router;
