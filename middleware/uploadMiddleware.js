const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const allowedDocTypes = ['application/pdf'];
  const allowedVideoTypes = ['video/mp4', 'video/webm'];

  const allowedTypes = [...allowedImageTypes, ...allowedDocTypes, ...allowedVideoTypes];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: jpg, png, gif, webp, pdf, mp4, webm'), false);
  }
};

// Storage configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'sarra_assets',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp', 'pdf', 'mp4', 'webm'],
    resource_type: 'auto',
    // Generate unique filenames to prevent overwrites
    public_id: (req, file) => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      return `${file.fieldname}_${timestamp}_${random}`;
    },
  },
});

// Multer upload with size limits and validation
const upload = multer({
  storage: storage,
  limits: {
    // File size limits
    fileSize: 10 * 1024 * 1024, // 10MB max (5MB for images, 10MB for documents)
    files: 10, // Max 10 files per request
  },
  fileFilter: fileFilter,
});

// Error handling wrapper for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Too many files. Maximum is 10 files.' });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

module.exports = { upload, cloudinary, handleMulterError };