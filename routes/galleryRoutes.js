const express = require('express');
const router = express.Router();
const galleryController = require('../controllers/galleryController');
const { upload, handleMulterError } = require('../middleware/uploadMiddleware');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, upload.single('image'), handleMulterError, galleryController.createGallery);
router.get('/', galleryController.getGallery);
router.delete('/:id', auth, galleryController.deleteGallery);

module.exports = router;
