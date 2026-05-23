const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');

// Public routes
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);

// Protected routes (require authentication)
router.post('/logout', auth, authController.logout);

// Register is protected - only existing admins can create new ones
// Note: This should be removed or heavily restricted in production
router.post('/register', auth, authController.register);

module.exports = router;