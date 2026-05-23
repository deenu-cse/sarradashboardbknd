const Ticker = require('../models/Ticker');
const mongoose = require('mongoose');

// Input validation helper
const validateTickerInput = (text, link) => {
  const errors = [];

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    errors.push('Text is required');
  } else if (text.trim().length > 500) {
    errors.push('Text must be less than 500 characters');
  }

  // Validate link if provided
  if (link && typeof link === 'string') {
    try {
      const url = new URL(link);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('Link must be a valid HTTP or HTTPS URL');
      }
    } catch (err) {
      errors.push('Link must be a valid URL');
    }
  }

  return errors;
};

exports.createTicker = async (req, res) => {
  try {
    const { text, link } = req.body;

    // Validate input
    const validationErrors = validateTickerInput(text, link);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', ') });
    }

    const ticker = new Ticker({
      text: text.trim(),
      link: link ? link.trim() : undefined
    });

    await ticker.save();
    res.status(201).json(ticker);
  } catch (err) {
    console.error('Create ticker error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getTickers = async (req, res) => {
  try {
    // Public endpoint - return only active tickers
    const tickers = await Ticker.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(50); // Limit to prevent large responses

    res.status(200).json(tickers);
  } catch (err) {
    console.error('Get tickers error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteTicker = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ticker ID' });
    }

    const ticker = await Ticker.findByIdAndDelete(id);
    if (!ticker) {
      return res.status(404).json({ message: 'Ticker not found' });
    }

    res.status(200).json({ message: 'Ticker deleted successfully' });
  } catch (err) {
    console.error('Delete ticker error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateTickerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ticker ID' });
    }

    // Validate isActive is boolean
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be a boolean' });
    }

    const ticker = await Ticker.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    );

    if (!ticker) {
      return res.status(404).json({ message: 'Ticker not found' });
    }

    res.status(200).json(ticker);
  } catch (err) {
    console.error('Update ticker status error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};