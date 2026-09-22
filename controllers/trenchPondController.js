const TrenchPond = require('../models/TrenchPond');
const { deleteStoredFile } = require('../utils/cloudinaryUtils');
const { getFileUrlPath } = require('../middleware/uploadMiddleware');

// Input validation helper
const validateTrenchPondInput = (label) => {
  const errors = [];

  if (label && label.trim().length > 200) {
    errors.push('Label must be less than 200 characters');
  }

  return errors;
};

exports.createTrenchPond = async (req, res) => {
  try {
    const { label } = req.body;

    // Validate input
    const validationErrors = validateTrenchPondInput(label);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', ') });
    }

    const image = req.file ? getFileUrlPath(req.file) : '';

    if (!image) {
      return res.status(400).json({ message: 'Image is required' });
    }

    const trenchPond = new TrenchPond({
      image,
      label: label ? label.trim() : undefined
    });

    await trenchPond.save();
    res.status(201).json(trenchPond);
  } catch (err) {
    console.error('Create trench/pond error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getTrenchPonds = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const parsedPage = Math.max(1, parseInt(page) || 1);
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const skip = (parsedPage - 1) * parsedLimit;

    const [trenchPonds, total] = await Promise.all([
      TrenchPond.find().sort({ createdAt: -1 }).skip(skip).limit(parsedLimit),
      TrenchPond.countDocuments()
    ]);

    res.status(200).json({
      data: trenchPonds,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit)
      }
    });
  } catch (err) {
    console.error('Get trench/ponds error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteTrenchPond = async (req, res) => {
  try {
    const { id } = req.params;
    const mongoose = require('mongoose');

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID' });
    }

    const trenchPond = await TrenchPond.findById(id);
    if (!trenchPond) {
      return res.status(404).json({ message: 'Trench/Pond not found' });
    }

    if (trenchPond.image) {
      await deleteStoredFile(trenchPond.image);
    }

    await TrenchPond.findByIdAndDelete(id);

    res.status(200).json({ message: 'Trench/Pond deleted successfully' });
  } catch (err) {
    console.error('Delete trench/pond error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};
