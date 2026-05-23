const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const protect = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

// Rate limiting for public contact submission to prevent spam
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per IP per hour
  message: { message: 'Too many requests from this IP, please try again after an hour' }
});

// Public route (with rate limiting)
router.post('/', contactLimiter, contactController.createContact);

// Protected Admin Routes
router.use(protect);
router.get('/', contactController.getContacts);
router.patch('/:id/status', contactController.updateStatus);
router.delete('/:id', contactController.deleteContact);

module.exports = router;
