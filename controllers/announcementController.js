const Announcement = require('../models/Announcement');
const mongoose = require('mongoose');

// Input validation helper
const validateAnnouncementInput = (title, description) => {
  const errors = [];

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Title is required');
  } else if (title.trim().length > 200) {
    errors.push('Title must be less than 200 characters');
  }

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    errors.push('Description is required');
  } else if (description.trim().length > 5000) {
    errors.push('Description must be less than 5000 characters');
  }

  return errors;
};

exports.createAnnouncement = async (req, res) => {
  try {
    const { title, description } = req.body;

    // Validate input
    const validationErrors = validateAnnouncementInput(title, description);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', ') });
    }

    const image = req.file ? req.file.path : '';

    const announcement = new Announcement({
      title: title.trim(),
      description: description.trim(),
      image
    });

    await announcement.save();
    res.status(201).json(announcement);
  } catch (err) {
    console.error('Create announcement error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAnnouncements = async (req, res) => {
  try {
    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    const [announcements, total] = await Promise.all([
      Announcement.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Announcement.countDocuments()
    ]);

    res.status(200).json({
      data: announcements,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get announcements error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid announcement ID' });
    }

    const announcement = await Announcement.findByIdAndDelete(id);
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    res.status(200).json({ message: 'Announcement deleted successfully' });
  } catch (err) {
    console.error('Delete announcement error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAnnouncementBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ message: 'Invalid slug parameter' });
    }

    const param = slug.trim();

    // Check if the param is a valid MongoDB ObjectId
    const isObjectId = mongoose.Types.ObjectId.isValid(param);

    let query = { slug: param };
    if (isObjectId) {
      query = { $or: [{ slug: param }, { _id: param }] };
    }

    const announcement = await Announcement.findOne(query);

    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    res.status(200).json(announcement);
  } catch (err) {
    console.error('Get announcement by slug error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};