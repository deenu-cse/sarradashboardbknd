const express = require('express');
const router = express.Router();
const trenchPondController = require('../controllers/trenchPondController');
const { upload, handleMulterError } = require('../middleware/uploadMiddleware');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, upload.single('image'), handleMulterError, trenchPondController.createTrenchPond);
router.get('/', trenchPondController.getTrenchPonds);
router.delete('/:id', auth, trenchPondController.deleteTrenchPond);

module.exports = router;
