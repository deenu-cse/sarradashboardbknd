const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const { upload, handleMulterError } = require('../middleware/uploadMiddleware');
const auth = require('../middleware/authMiddleware');

const announcementUpload = upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'image', maxCount: 1 },
  { name: 'pdf', maxCount: 1 }
]);

router.post('/', auth, announcementUpload, handleMulterError, announcementController.createAnnouncement);
router.get('/', announcementController.getAnnouncements);
router.get('/:id', announcementController.getAnnouncementById);
router.get('/slug/:slug', announcementController.getAnnouncementBySlug);
router.put('/:id', auth, announcementUpload, handleMulterError, announcementController.updateAnnouncement);
router.delete('/:id', auth, announcementController.deleteAnnouncement);

module.exports = router;
