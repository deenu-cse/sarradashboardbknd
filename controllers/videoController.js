const Video = require('../models/Video');

// Helper to extract YouTube Video ID
const getYoutubeId = (url) => {
  if (!url || typeof url !== 'string') return null;
  const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(reg);
  return match ? match[1] : null;
};

// Input validation helper
const validateVideoInput = (title, videoUrl) => {
  const errors = [];

  if (title && title.trim().length > 200) {
    errors.push('Title must be less than 200 characters');
  }

  if (!videoUrl || typeof videoUrl !== 'string' || videoUrl.trim().length === 0) {
    errors.push('YouTube video URL is required');
  } else {
    const videoId = getYoutubeId(videoUrl);
    if (!videoId) {
      errors.push('Invalid YouTube video URL');
    }
  }

  return errors;
};

exports.createVideo = async (req, res) => {
  try {
    const { title, videoUrl, district } = req.body;

    // Validate input
    const validationErrors = validateVideoInput(title, videoUrl);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', ') });
    }

    const videoId = getYoutubeId(videoUrl);

    const video = new Video({
      title: title ? title.trim() : undefined,
      videoUrl: videoUrl.trim(),
      videoId,
      district: district ? district.trim() : undefined
    });

    await video.save();
    res.status(201).json(video);
  } catch (err) {
    console.error('Create video error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getVideos = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const parsedPage = Math.max(1, parseInt(page) || 1);
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 50), 100);
    const skip = (parsedPage - 1) * parsedLimit;

    const [videos, total] = await Promise.all([
      Video.find({}).sort({ createdAt: -1 }).skip(skip).limit(parsedLimit),
      Video.countDocuments({})
    ]);

    res.status(200).json({
      data: videos,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit)
      }
    });
  } catch (err) {
    console.error('Get videos error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const mongoose = require('mongoose');

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid video ID' });
    }

    const video = await Video.findById(id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    await Video.findByIdAndDelete(id);

    res.status(200).json({ message: 'Video deleted successfully' });
  } catch (err) {
    console.error('Delete video error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};
