const Announcement = require('../models/Announcement');
const { deleteStoredFile } = require('../utils/cloudinaryUtils');
const { getFileUrlPath } = require('../middleware/uploadMiddleware');
const mongoose = require('mongoose');

// Input validation helper
const validateAnnouncementInput = (title, description) => {
  const errors = [];

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Title is required');
  } else if (title.trim().length > 1000) {
    errors.push('Title must be less than 1000 characters');
  }

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    errors.push('Description is required');
  } else if (description.trim().length > 15000) {
    errors.push('Description must be less than 15000 characters');
  }

  return errors;
};

exports.createAnnouncement = async (req, res) => {
  try {
    const { title, description, date, lastDate } = req.body;

    // Validate input
    const validationErrors = validateAnnouncementInput(title, description);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', ') });
    }

    let images = [];
    let image = '';
    let pdfUrl = '';

    if (req.files) {
      if (req.files.images) {
        images = req.files.images.map(file => getFileUrlPath(file));
      }
      if (req.files.image && req.files.image[0]) {
        image = getFileUrlPath(req.files.image[0]);
      }
      if (req.files.pdf && req.files.pdf[0]) {
        pdfUrl = getFileUrlPath(req.files.pdf[0]);
      }
    }

    if (images.length > 0) {
      if (!image) image = images[0];
    } else if (image) {
      images.push(image);
    }

    let parsedDate = Date.now();
    if (date) {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        parsedDate = d;
      }
    }

    let parsedLastDate = null;
    if (lastDate && typeof lastDate === 'string' && lastDate.trim() !== '' && lastDate !== 'null') {
      const ld = new Date(lastDate);
      if (!isNaN(ld.getTime())) {
        parsedLastDate = ld;
      }
    }

    const announcement = new Announcement({
      title: title.trim(),
      description: description.trim(),
      image,
      images,
      pdfUrl,
      date: parsedDate,
      lastDate: parsedLastDate
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

    if (announcement.images && announcement.images.length > 0) {
      announcement.images.forEach(img => {
        deleteStoredFile(img);
      });
    }
    if (announcement.image && (!announcement.images || !announcement.images.includes(announcement.image))) {
      deleteStoredFile(announcement.image);
    }
    if (announcement.pdfUrl) {
      deleteStoredFile(announcement.pdfUrl);
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

exports.getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid announcement ID' });
    }
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    res.status(200).json(announcement);
  } catch (err) {
    console.error('Get announcement by ID error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid announcement ID' });
    }

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    const { title, description, date, lastDate, removePdf } = req.body;
    let removeImages = [];
    if (req.body.removeImages) {
      try {
        removeImages = typeof req.body.removeImages === 'string'
          ? JSON.parse(req.body.removeImages)
          : req.body.removeImages;
      } catch (e) {
        removeImages = [];
      }
    }

    // Validate inputs if provided
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ message: 'Title is required' });
      }
      announcement.title = title.trim();
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim().length === 0) {
        return res.status(400).json({ message: 'Description is required' });
      }
      announcement.description = description.trim();
    }

    if (date !== undefined) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
      announcement.date = parsedDate;
    }

    if (lastDate !== undefined) {
      if (!lastDate || lastDate === '' || lastDate === 'null') {
        announcement.lastDate = null;
      } else {
        const parsedLastDate = new Date(lastDate);
        if (isNaN(parsedLastDate.getTime())) {
          return res.status(400).json({ message: 'Invalid last date format' });
        }
        announcement.lastDate = parsedLastDate;
      }
    }

    // Handle file removals
    if (removePdf === 'true' || removePdf === true) {
      if (announcement.pdfUrl) {
        deleteStoredFile(announcement.pdfUrl);
      }
      announcement.pdfUrl = '';
    }

    // Remove specific images
    if (removeImages.length > 0) {
      const remainingImages = [];
      if (announcement.images && announcement.images.length > 0) {
        announcement.images.forEach(img => {
          if (removeImages.includes(img)) {
            deleteStoredFile(img);
          } else {
            remainingImages.push(img);
          }
        });
      }
      announcement.images = remainingImages;
    }

    // Handle new file uploads
    let newImages = [];
    if (req.files) {
      if (req.files.images) {
        newImages = req.files.images.map(file => getFileUrlPath(file));
      }
      if (req.files.pdf && req.files.pdf[0]) {
        if (announcement.pdfUrl) {
          deleteStoredFile(announcement.pdfUrl);
        }
        announcement.pdfUrl = getFileUrlPath(req.files.pdf[0]);
      }
      // Single legacy image if provided
      if (req.files.image && req.files.image[0]) {
        if (announcement.image) {
          deleteStoredFile(announcement.image);
        }
        const legacyImage = getFileUrlPath(req.files.image[0]);
        announcement.image = legacyImage;
        if (!announcement.images) {
          announcement.images = [];
        }
        if (!announcement.images.includes(legacyImage)) {
          announcement.images.push(legacyImage);
        }
      }
    }

    // Append new images to the array
    if (newImages.length > 0) {
      announcement.images = [...(announcement.images || []), ...newImages];
    }

    // Always ensure legacy announcement.image is synchronized with the first image
    if (announcement.images && announcement.images.length > 0) {
      announcement.image = announcement.images[0];
    } else if (announcement.image && (!announcement.images || announcement.images.length === 0)) {
      announcement.images = [announcement.image];
    } else {
      announcement.image = '';
    }

    await announcement.save();
    res.status(200).json(announcement);
  } catch (err) {
    console.error('Update announcement error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};