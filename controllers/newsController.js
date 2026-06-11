const News = require('../models/News');
const mongoose = require('mongoose');

// Input validation helper
const validateNewsInput = (title, sections) => {
  const errors = [];

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Title is required');
  } else if (title.trim().length > 200) {
    errors.push('Title must be less than 200 characters');
  }

  // Validate sections if provided
  if (sections && Array.isArray(sections)) {
    sections.forEach((section, index) => {
      if (section.title && section.title.length > 200) {
        errors.push(`Section ${index + 1}: Title must be less than 200 characters`);
      }
      if (section.description && section.description.length > 5000) {
        errors.push(`Section ${index + 1}: Description must be less than 5000 characters`);
      }
    });
  }

  return errors;
};

exports.createNews = async (req, res) => {
  try {
    const { title, district_news } = req.body;

    // Parse sections if string
    let sections = [];
    if (req.body.sections) {
      try {
        sections = typeof req.body.sections === 'string'
          ? JSON.parse(req.body.sections)
          : req.body.sections;
      } catch (parseErr) {
        return res.status(400).json({ message: 'Invalid sections format' });
      }
    }

    // Validate input
    const validationErrors = validateNewsInput(title, sections);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', ') });
    }

    // Process files
    let thumbnail = '';
    let images = [];

    if (req.files) {
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        thumbnail = req.files.thumbnail[0].path;
      }
      if (req.files.images) {
        images = req.files.images.map(file => file.path);
      }
      // Handle section images
      sections = sections.map((section, idx) => {
        const fieldName = `sectionImage_${idx}`;
        if (req.files[fieldName] && req.files[fieldName][0]) {
          section.image = req.files[fieldName][0].path;
        }
        return section;
      });
    }

    const news = new News({
      title: title.trim(),
      thumbnail,
      district_news: district_news === 'true' || district_news === true,
      sections,
      images
    });

    await news.save();
    res.status(201).json(news);
  } catch (err) {
    console.error('Create news error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getNews = async (req, res) => {
  try {
    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [news, total] = await Promise.all([
      News.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      News.countDocuments()
    ]);

    res.status(200).json({
      data: news,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get news error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getNewsBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ message: 'Invalid slug parameter' });
    }

    const article = await News.findOne({ slug: slug.trim() });
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }
    res.status(200).json(article);
  } catch (err) {
    console.error('Get news by slug error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteNews = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid news ID' });
    }

    const news = await News.findByIdAndDelete(id);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    res.status(200).json({ message: 'News deleted successfully' });
  } catch (err) {
    console.error('Delete news error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};