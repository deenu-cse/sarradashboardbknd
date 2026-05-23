const express = require('express');
const router = express.Router();
const News = require('../models/News');
const Gallery = require('../models/Gallery');
const Ticker = require('../models/Ticker');
const Admin = require('../models/Admin');
const Publication = require('../models/Publication');
const Announcement = require('../models/Announcement');
const auth = require('../middleware/authMiddleware');

// ALL routes in this file are PROTECTED - require authentication
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const [newsCount, galleryCount, tickerCount, adminCount, publicationCount, announcementCount] = await Promise.all([
      News.countDocuments(),
      Gallery.countDocuments(),
      Ticker.countDocuments({ isActive: true }),
      Admin.countDocuments(),
      Publication.countDocuments(),
      Announcement.countDocuments()
    ]);

    res.json({
      news: newsCount,
      gallery: galleryCount,
      activeTickers: tickerCount,
      admins: adminCount,
      publications: publicationCount,
      announcements: announcementCount
    });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;