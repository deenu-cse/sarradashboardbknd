const express = require('express');
const router = express.Router();
const tickerController = require('../controllers/tickerController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, tickerController.createTicker);
router.get('/', tickerController.getTickers);
router.delete('/:id', auth, tickerController.deleteTicker);
router.patch('/:id', auth, tickerController.updateTickerStatus);

module.exports = router;
