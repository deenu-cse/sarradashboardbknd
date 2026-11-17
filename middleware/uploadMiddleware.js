const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const uploadRoot = path.join(__dirname, '..', 'uploads');
const uploadDirs = {
  images: path.join(uploadRoot, 'images'),
  pdfs: path.join(uploadRoot, 'pdfs'),
  applications: path.join(uploadRoot, 'applications')
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

const getSafeFilename = (file, ext = path.extname(file.originalname || '').toLowerCase()) => {
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

// Candidate documents. uploads/applications is deliberately not served by express.static
// in index.js: resumes and photos are only readable through the authenticated /api/applications routes.
const MAX_APPLICATION_FILE_MB = 5;

// Allowed mimetype -> stored extension. The extension always comes from here, never from
// the candidate's filename, so a public upload can't place an .html or .js file on disk.
const APPLICATION_FILE_TYPES = {
  image: { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' },
  pdf: { 'application/pdf': '.pdf' }
};
APPLICATION_FILE_TYPES.any = { ...APPLICATION_FILE_TYPES.image, ...APPLICATION_FILE_TYPES.pdf };

const APPLICATION_FILE_LABELS = {
  image: 'a JPG, PNG or WEBP image',
  pdf: 'a PDF',
  any: 'a JPG, PNG or WEBP image, or a PDF'
};

// The mimetype is whatever the browser claims, so the file's first bytes are checked as well
const FILE_SIGNATURES = {
  'application/pdf': (header) => header.toString('latin1', 0, 5) === '%PDF-',
  'image/jpeg': (header) => header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff,
  'image/png': (header) => header.toString('latin1', 1, 4) === 'PNG',
  'image/webp': (header) => header.toString('latin1', 0, 4) === 'RIFF' && header.toString('latin1', 8, 12) === 'WEBP'
};

const hasValidFileSignature = async (file) => {
  const handle = await fs.promises.open(file.path, 'r');
  try {
    const { buffer } = await handle.read(Buffer.alloc(12), 0, 12, 0);
    return FILE_SIGNATURES[file.mimetype](buffer);
  } finally {
    await handle.close();
  }
};

// Built per request because the accepted fields and file types come from the job's document list
const createApplicationUpload = (job) => {
  const requirements = new Map(job.documents.map((doc) => [doc._id.toString(), doc]));

  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadDirs.applications);
      },
      filename: (req, file, cb) => {
        const { fileType } = requirements.get(file.fieldname);
        const safeFilename = getSafeFilename(file, APPLICATION_FILE_TYPES[fileType][file.mimetype]);
        file.publicPath = `/uploads/applications/${safeFilename}`;
        cb(null, safeFilename);
      }
    }),
    limits: {
      fileSize: MAX_APPLICATION_FILE_MB * 1024 * 1024,
      files: requirements.size,
      fields: 20,
      fieldSize: 16 * 1024
    },
    defParamCharset: 'utf8', // Keeps Hindi filenames readable in the dashboard
    fileFilter: (req, file, cb) => {
      const { label, fileType } = requirements.get(file.fieldname);
      if (APPLICATION_FILE_TYPES[fileType][file.mimetype]) {
        cb(null, true);
      } else {
        cb(new Error(`${label} must be ${APPLICATION_FILE_LABELS[fileType]}.`), false);
      }
    }
  }).fields([...requirements.keys()].map((name) => ({ name, maxCount: 1 })));
};

const uploadApplicationFiles = (req, res, next) => {
  createApplicationUpload(req.job)(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: `Each file must be ${MAX_APPLICATION_FILE_MB}MB or smaller.` });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: 'The document list for this job has changed. Please refresh the page and try again.' });
    }
    return res.status(400).json({ message: err.message });
  });
};

module.exports = {
  upload,
  getFileUrlPath,
  handleMulterError,
  uploadApplicationFiles,
  hasValidFileSignature,
  APPLICATION_FILE_LABELS
};