const Gallery = require('../models/Gallery');

// Input validation helper
const validateGalleryInput = (title, type) => {
  const errors = [];

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Title is required');
  } else if (title.trim().length > 200) {
    errors.push('Title must be less than 200 characters');
  }

  if (!type || !['global', 'district'].includes(type)) {
    errors.push('Type must be either "global" or "district"');
  }

  return errors;
};

// Sanitize input for regex to prevent NoSQL injection
const sanitizeForRegex = (input) => {
  if (typeof input !== 'string') return '';
  // Escape special regex characters
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim();
};

exports.createGallery = async (req, res) => {
  try {
    const { title, type, district } = req.body;

    // Validate input
    const validationErrors = validateGalleryInput(title, type);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', ') });
    }

    // Validate district for district type
    if (type === 'district') {
      if (!district || typeof district !== 'string' || district.trim().length === 0) {
        return res.status(400).json({ message: 'District is required for district type' });
      }
    }

    const image = req.file ? req.file.path : '';

    if (!image) {
      return res.status(400).json({ message: 'Image is required' });
    }

    const gallery = new Gallery({
      title: title.trim(),
      image,
      type,
      district: district ? district.trim() : undefined
    });

    await gallery.save();
    res.status(201).json(gallery);
  } catch (err) {
    console.error('Create gallery error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getGallery = async (req, res) => {
  try {
    const { type, district, page = 1, limit = 20 } = req.query;

    // Validate and sanitize inputs
    const parsedPage = Math.max(1, parseInt(page) || 1);
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const skip = (parsedPage - 1) * parsedLimit;

    let filter = {};

    // Validate type
    if (type && ['global', 'district'].includes(type)) {
      filter.type = type;
    }

    // Sanitize district to prevent NoSQL injection
    if (district && typeof district === 'string') {
      const sanitizedDistrict = sanitizeForRegex(district);
      if (sanitizedDistrict) {
        filter.district = { $regex: new RegExp(`^${sanitizedDistrict}$`, 'i') };
      }
    }

    const [gallery, total] = await Promise.all([
      Gallery.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parsedLimit),
      Gallery.countDocuments(filter)
    ]);

    res.status(200).json({
      data: gallery,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit)
      }
    });
  } catch (err) {
    console.error('Get gallery error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteGallery = async (req, res) => {
  try {
    const { id } = req.params;
    const mongoose = require('mongoose');

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid gallery ID' });
    }

    const gallery = await Gallery.findByIdAndDelete(id);
    if (!gallery) {
      return res.status(404).json({ message: 'Gallery item not found' });
    }

    res.status(200).json({ message: 'Gallery item deleted successfully' });
  } catch (err) {
    console.error('Delete gallery error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};