const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const uploadRoot = path.join(__dirname, '..', 'uploads');
const uploadDirs = {
  images: path.join(uploadRoot, 'images'),
  pdfs: path.join(uploadRoot, 'pdfs')
};

Object.values(uploadDirs).forEach((dir) => {
  fs.mkdirSync(dir, { recursive: true });
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const allowedDocTypes = ['application/pdf'];
  const allowedTypes = [...allowedImageTypes, ...allowedDocTypes];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: jpg, png, gif, webp, pdf'), false);
  }
};

const getUploadDirectory = (file) => {
  if (file.mimetype === 'application/pdf') {
    return uploadDirs.pdfs;
  }
  return uploadDirs.images;
};

const getSafeFilename = (file) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const baseName = `${file.fieldname}_${timestamp}_${randomSuffix}`;
  return `${baseName}${ext}`;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadDirectory(file));
  },
  filename: (req, file, cb) => {
    const safeFilename = getSafeFilename(file);
    const relativeFolder = file.mimetype === 'application/pdf' ? '/uploads/pdfs' : '/uploads/images';
    file.publicPath = `${relativeFolder}/${safeFilename}`;
    cb(null, safeFilename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 30 * 1024 * 1024,
    files: 10,
  },
  fileFilter,
});

const getFileUrlPath = (file) => {
  if (!file) return '';
  if (typeof file === 'string') return file;
  if (file.publicPath) return file.publicPath;
  if (file.path) {
    const normalizedPath = file.path.replace(/\\/g, '/');
    const uploadsIndex = normalizedPath.lastIndexOf('/uploads/');
    if (uploadsIndex !== -1) {
      return normalizedPath.slice(uploadsIndex);
    }
    return normalizedPath;
  }
  return '';
};

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

module.exports = { upload, getFileUrlPath, handleMulterError };