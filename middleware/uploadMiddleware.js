const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 120000 // 120 seconds to prevent Request Timeout for large PDFs
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
  params: async (req, file) => {
    const isPdf = file.mimetype === 'application/pdf';
    // Extract file extension from original name (e.g. ".pdf")
    const ext = file.originalname ? file.originalname.substring(file.originalname.lastIndexOf('.')) : '';
    const uniqueId = `${file.fieldname}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return {
      folder: 'sarra_assets',
      allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp', 'pdf', 'mp4', 'webm'],
      resource_type: isPdf ? 'raw' : 'auto',
      // Append .pdf extension so Cloudinary serves correct Content-Type header
      public_id: isPdf ? `${uniqueId}${ext}` : uniqueId,
    };
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 30 * 1024 * 1024,
    files: 10,
  },
  fileFilter: fileFilter,
});

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 30MB.' });
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