const CommunityEngagement = require('../models/CommunityEngagement');
const { deleteStoredFile } = require('../utils/cloudinaryUtils');
const { getFileUrlPath } = require('../middleware/uploadMiddleware');

const validateDescription = (description) => {
  const errors = [];

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    errors.push('Description is required');
  }

  if (description && description.trim().length > 500) {
    errors.push('Description must be less than 500 characters');
  }

  return errors;
};

exports.createCommunityEngagement = async (req, res) => {
  try {
    const { title, description } = req.body;
    const validationErrors = validateDescription(description);

    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', ') });
    }

    const image = req.file ? getFileUrlPath(req.file) : '';
    if (!image) {
      return res.status(400).json({ message: 'Image is required' });
    }

    const item = await CommunityEngagement.create({
      title: title ? title.trim() : 'Community Engagement',
      description: description.trim(),
      image,
      sortOrder: Date.now(),
    });

    return res.status(201).json(item);
  } catch (error) {
    console.error('Create community engagement error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getCommunityEngagement = async (req, res) => {
  try {
    const items = await CommunityEngagement.find({})
      .sort({ sortOrder: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({ data: items });
  } catch (error) {
    console.error('Get community engagement error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteCommunityEngagement = async (req, res) => {
  try {
    const { id } = req.params;
    const mongoose = require('mongoose');

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid community engagement ID' });
    }

    const item = await CommunityEngagement.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Community engagement item not found' });
    }

    if (item.image) {
      await deleteStoredFile(item.image);
    }

    await CommunityEngagement.findByIdAndDelete(id);

    return res.status(200).json({ message: 'Community engagement image deleted successfully' });
  } catch (error) {
    console.error('Delete community engagement error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
