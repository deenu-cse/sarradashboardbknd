const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, videoController.createVideo);
router.get('/', videoController.getVideos);
router.delete('/:id', auth, videoController.deleteVideo);

module.exports = router;
