const News = require('../models/News');
const { deleteFromCloudinary } = require('../utils/cloudinaryUtils');
const mongoose = require('mongoose');

// Input validation helper
const validateNewsInput = (title, sections) => {
  const errors = [];

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Title is required');
  } else if (title.trim().length > 1000) {
    errors.push('Title must be less than 1000 characters');
  }

  // Validate sections if provided
  if (sections && Array.isArray(sections)) {
    sections.forEach((section, index) => {
      if (section.title && section.title.length > 1000) {
        errors.push(`Section ${index + 1}: Title must be less than 1000 characters`);
      }
      if (section.description && section.description.length > 15000) {
        errors.push(`Section ${index + 1}: Description must be less than 15000 characters`);
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

exports.getNewsById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid news ID' });
    }

    const article = await News.findById(id);
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }
    res.status(200).json(article);
  } catch (err) {
    console.error('Get news by ID error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};



exports.updateNews = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid news ID' });
    }

    const news = await News.findById(id);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    const { title, district_news, removeThumbnail } = req.body;

    // Parse sections
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

    // Parse list of section image indices to remove
    let removeSectionImages = [];
    if (req.body.removeSectionImages) {
      try {
        removeSectionImages = typeof req.body.removeSectionImages === 'string'
          ? JSON.parse(req.body.removeSectionImages)
          : req.body.removeSectionImages;
      } catch {
        removeSectionImages = [];
      }
    }

    // Validate input
    const validationErrors = validateNewsInput(title || news.title, sections);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', ') });
    }

    // Track old images to clean up from Cloudinary
    const imagesToDelete = [];

    // Update title
    if (title !== undefined) {
      news.title = title.trim();
    }

    // Update district_news
    if (district_news !== undefined) {
      news.district_news = district_news === 'true' || district_news === true;
    }

    // Handle thumbnail
    if (removeThumbnail === 'true' || removeThumbnail === true) {
      if (news.thumbnail) {
        imagesToDelete.push(news.thumbnail);
      }
      news.thumbnail = '';
    }
    if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
      // New thumbnail uploaded - delete old one
      if (news.thumbnail) {
        imagesToDelete.push(news.thumbnail);
      }
      news.thumbnail = req.files.thumbnail[0].path;
    }

    // Handle sections
    sections = sections.map((section, idx) => {
      // Check if this section image should be removed
      if (removeSectionImages.includes(idx)) {
        // Find old section image to delete
        if (news.sections[idx] && news.sections[idx].image) {
          imagesToDelete.push(news.sections[idx].image);
        }
        section.image = '';
      } else if (req.files && req.files[`sectionImage_${idx}`] && req.files[`sectionImage_${idx}`][0]) {
        // New section image uploaded - delete old one
        if (news.sections[idx] && news.sections[idx].image) {
          imagesToDelete.push(news.sections[idx].image);
        }
        section.image = req.files[`sectionImage_${idx}`][0].path;
      } else {
        // Keep existing image if present
        if (news.sections[idx] && news.sections[idx].image && !section.image) {
          section.image = news.sections[idx].image;
        }
      }
      return section;
    });

    news.sections = sections;

    await news.save();

    // Clean up old images from Cloudinary (fire-and-forget)
    // Clean up old images from Cloudinary (fire-and-forget)
    for (const imgUrl of imagesToDelete) {
      deleteFromCloudinary(imgUrl);
    }

    res.status(200).json(news);
  } catch (err) {
    console.error('Update news error:', err.message);
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

    const news = await News.findById(id);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    // Clean up Cloudinary assets
    if (news.thumbnail) {
      deleteFromCloudinary(news.thumbnail);
    }
    if (news.images && news.images.length > 0) {
      for (const imgUrl of news.images) {
        deleteFromCloudinary(imgUrl);
      }
    }
    if (news.sections && news.sections.length > 0) {
      for (const section of news.sections) {
        if (section.image) {
          deleteFromCloudinary(section.image);
        }
      }
    }

    await News.findByIdAndDelete(id);

    res.status(200).json({ message: 'News deleted successfully' });
  } catch (err) {
    console.error('Delete news error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};