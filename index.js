const express = require('express');
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

const app = express();

// SECURITY HEADERS (Helmet.js)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      fontSrc: ["'self'"],
      // Allow Cloudinary PDFs to be embedded/viewed in browser
      objectSrc: ["'self'", "https://res.cloudinary.com"],
      frameSrc: ["'self'", "https://res.cloudinary.com"],
      connectSrc: ["'self'", "https://res.cloudinary.com"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// Hide X-Powered-By header
app.disable('x-powered-by');

// REQUEST SIZE LIMITS
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

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

// COOKIE PARSER
app.use(cookieParser());

// RATE LIMITING - All endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// STRICTER RATE LIMITING for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs (login attempts)
  message: { message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
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

// Database connection with TLS
mongoose.connect(process.env.MONGODB_URI, {
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

  // Always return generic message to client
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;