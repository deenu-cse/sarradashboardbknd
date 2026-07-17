const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const protect = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Increased to 50 requests per IP per hour to prevent accidental blocking
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
