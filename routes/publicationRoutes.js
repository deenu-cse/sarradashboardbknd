const express = require('express');
const router = express.Router();
const publicationController = require('../controllers/publicationController');
const { upload } = require('../middleware/uploadMiddleware');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, upload.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]), publicationController.createPublication);
router.get('/', publicationController.getPublications);
router.delete('/:id', auth, publicationController.deletePublication);

module.exports = router;
