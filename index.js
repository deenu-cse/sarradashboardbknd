const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

dotenv.config();

// Bypass local SSL cert verification for external requests during dev
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const app = express();

// Trust proxy for Render load balancers - critical for rate limiting and secure cookies
app.set('trust proxy', 1);

// CORS CONFIGURATION - Strict whitelist from env
const corsOptions = {
  origin: function (origin, callback) {
    const defaultOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'https://sarra-neon.vercel.app', 'https://sarradashboard.vercel.app'];
    const envOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : [];
    const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];
    // Allow requests with no origin (mobile apps, curl requests) in development
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};
app.use(cors(corsOptions));

// SECURITY HEADERS (Helmet.js)
const isProduction = process.env.NODE_ENV === 'production' && process.env.ENABLE_HTTPS === 'true';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"],
      objectSrc: ["'self'"],
      frameSrc: ["'self'"],
      connectSrc: ["'self'"],
      ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
}));

// Hide X-Powered-By header
app.disable('x-powered-by');

// REQUEST SIZE LIMITS - Increased for contact form messages
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// COOKIE PARSER
app.use(cookieParser());

// Serve uploaded files publicly
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Strip port from IP address (IIS reverse proxy sometimes sends "ip:port" format)
const stripPort = (ip) => ip ? ip.split(':').slice(0, ip.includes('.') ? 1 : -1).join(':').replace(/^\[|\]$/g, '') || ip.split(':')[0] : ip;

const getCleanIp = (req) => {
  const rawIp = req.ip || req.connection.remoteAddress || '';
  // If it's IPv4 with a port (e.g. "10.67.58.6:21646"), strip the port
  if (rawIp.includes('.') && rawIp.includes(':')) {
    return rawIp.split(':')[0];
  }
  return rawIp;
};

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Increased limit
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getCleanIp,
});

// STRICTER RATE LIMITING for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Increased to 50 for testing, change back to 10 in prod
  message: { message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getCleanIp,
});

// Apply rate limiting
app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// NOSQL INJECTION PREVENTION - MongoDB sanitize
app.use(mongoSanitize());

// XSS PREVENTION
app.use(xss());

// HTTP PARAMETER POLLUTION PREVENTION
app.use(hpp());

// Database connection with TLS (only for cloud/Atlas — local MongoDB doesn't use TLS)
const isLocalDB = process.env.MONGODB_URI.includes('localhost') || process.env.MONGODB_URI.includes('127.0.0.1');

mongoose.connect(process.env.MONGODB_URI, isLocalDB ? {} : {
  tls: true,
  tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production'
})
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.log('MongoDB connection error:', err.message));

// Audit logging middleware
const auditLogger = require('./middleware/auditLogger');
app.use(auditLogger);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/news', require('./routes/newsRoutes'));
app.use('/api/gallery', require('./routes/galleryRoutes'));
app.use('/api/publications', require('./routes/publicationRoutes'));
app.use('/api/ticker', require('./routes/tickerRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));

// Health check endpoint (no sensitive info)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// GLOBAL ERROR HANDLER - Never expose stack traces
app.use((err, req, res, next) => {
  console.error('Error:', err.message);

  // Log full error details server-side for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack:', err.stack);
  }

  const statusCode = err.status || err.statusCode || 500;

  // For client errors (4xx), pass through the message — it's safe and useful
  // For server errors (5xx), hide internals in production
  const message = statusCode < 500
    ? (err.message || 'Bad request')
    : (process.env.NODE_ENV === 'development' ? err.message : 'Internal server error');

  res.status(statusCode).json({ message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;