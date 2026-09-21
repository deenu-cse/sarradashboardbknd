const express = require('express');
const router = express.Router();
const communityEngagementController = require('../controllers/communityEngagementController');
const { upload, handleMulterError } = require('../middleware/uploadMiddleware');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, upload.single('image'), handleMulterError, communityEngagementController.createCommunityEngagement);
router.get('/', communityEngagementController.getCommunityEngagement);
router.delete('/:id', auth, communityEngagementController.deleteCommunityEngagement);

module.exports = router;
