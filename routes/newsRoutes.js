const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');
const { upload } = require('../middleware/uploadMiddleware');
const auth = require('../middleware/authMiddleware');

// Accept thumbnail + up to 10 images + up to 10 section images (sectionImage_0, sectionImage_1, etc.)
const newsUpload = upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'images', maxCount: 10 },
  { name: 'sectionImage_0', maxCount: 1 },
  { name: 'sectionImage_1', maxCount: 1 },
  { name: 'sectionImage_2', maxCount: 1 },
  { name: 'sectionImage_3', maxCount: 1 },
  { name: 'sectionImage_4', maxCount: 1 },
  { name: 'sectionImage_5', maxCount: 1 },
  { name: 'sectionImage_6', maxCount: 1 },
  { name: 'sectionImage_7', maxCount: 1 },
  { name: 'sectionImage_8', maxCount: 1 },
  { name: 'sectionImage_9', maxCount: 1 },
]);

router.post('/', auth, newsUpload, newsController.createNews);
router.get('/', newsController.getNews);
router.get('/slug/:slug', newsController.getNewsBySlug);
router.delete('/:id', auth, newsController.deleteNews);

module.exports = router;
