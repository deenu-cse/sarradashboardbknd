const Publication = require('../models/Publication');

// Input validation helper
const validatePublicationInput = (title, author) => {
  const errors = [];

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Title is required');
  } else if (title.trim().length > 200) {
    errors.push('Title must be less than 200 characters');
  }

  if (author && typeof author === 'string' && author.length > 100) {
    errors.push('Author must be less than 100 characters');
  }

  return errors;
};

exports.createPublication = async (req, res) => {
  try {
    const { title, author, description, datePublished } = req.body;

    // Validate input
    const validationErrors = validatePublicationInput(title, author);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', ') });
    }

    let coverImage = '';
    let pdfUrl = '';

    if (req.files) {
      if (req.files.coverImage && req.files.coverImage[0]) {
        coverImage = req.files.coverImage[0].path;
      }
      if (req.files.pdf && req.files.pdf[0]) {
        pdfUrl = req.files.pdf[0].path;
      }
    }

    // At least one file should be present
    if (!coverImage && !pdfUrl) {
      return res.status(400).json({ message: 'Cover image or PDF is required' });
    }

    const publication = new Publication({
      title: title.trim(),
      author: author ? author.trim() : undefined,
      coverImage,
      pdfUrl,
      description: description ? description.trim() : undefined,
      datePublished: datePublished ? new Date(datePublished) : undefined
    });

    await publication.save();
    res.status(201).json(publication);
  } catch (err) {
    console.error('Create publication error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getPublications = async (req, res) => {
  try {
    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [publications, total] = await Promise.all([
      Publication.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Publication.countDocuments()
    ]);

    res.status(200).json({
      data: publications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get publications error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deletePublication = async (req, res) => {
  try {
    const { id } = req.params;
    const mongoose = require('mongoose');

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid publication ID' });
    }

    const publication = await Publication.findByIdAndDelete(id);
    if (!publication) {
      return res.status(404).json({ message: 'Publication not found' });
    }

    res.status(200).json({ message: 'Publication deleted successfully' });
  } catch (err) {
    console.error('Delete publication error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};