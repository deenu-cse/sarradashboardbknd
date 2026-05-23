const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const { upload } = require('../middleware/uploadMiddleware');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, upload.single('image'), announcementController.createAnnouncement);
router.get('/', announcementController.getAnnouncements);
router.get('/slug/:slug', announcementController.getAnnouncementBySlug);
router.delete('/:id', auth, announcementController.deleteAnnouncement);

module.exports = router;
