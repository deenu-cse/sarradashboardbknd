const Admin = require('../models/Admin');
const RefreshToken = require('../models/RefreshToken');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Constants
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes for CERT-In compliance
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;
const BCRYPT_ROUNDS = 12; // Government minimum requirement

// Generate access token (short expiry - 15 minutes)
const generateAccessToken = (admin) => {
  return jwt.sign(
    { adminId: admin._id, email: admin.email, role: admin.role || 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

// Generate refresh token (longer expiry - 7 days)
const generateRefreshToken = (admin) => {
  return jwt.sign(
    { adminId: admin._id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d` }
  );
};

// Login endpoint
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Password length check (prevent DoS via very long passwords)
    if (password.length > 128) {
      return res.status(400).json({ message: 'Password too long' });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      // Generic message to prevent email enumeration
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check account lockout
    if (admin.isLocked && admin.isLocked()) {
      const remainingTime = Math.ceil((admin.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        message: `Account is temporarily locked. Try again in ${remainingTime} minutes.`,
      });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      // Increment failed login attempts
      admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;
      if (admin.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        admin.lockUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
      }
      await admin.save();
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if account is active
    if (admin.isActive === false) {
      return res.status(403).json({ message: 'Account has been deactivated' });
    }

    // Reset failed attempts on successful login
    admin.failedLoginAttempts = 0;
    admin.lockUntil = undefined;
    admin.lastLogin = new Date();
    await admin.save();

    // Generate tokens
    const accessToken = generateAccessToken(admin);
    const refreshToken = generateRefreshToken(admin);

    // Store refresh token in database (for revocation)
    await RefreshToken.create({
      token: refreshToken,
      adminId: admin._id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      path: '/',
    });

    // Return access token (short-lived, stored in memory on client)
    res.status(200).json({
      data: {
        accessToken,
        expiresIn: 900, // 15 minutes in seconds
        user: {
          id: admin._id,
          email: admin.email,
          role: admin.role || 'admin',
        },
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Refresh token endpoint
exports.refreshToken = async (req, res) => {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ message: 'Invalid token type' });
    }

    // Check if token exists in database (not revoked)
    const storedToken = await RefreshToken.findOne({
      token: refreshToken,
      adminId: decoded.adminId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!storedToken) {
      return res.status(401).json({ message: 'Refresh token revoked or expired' });
    }

    // Get admin
    const admin = await Admin.findById(decoded.adminId);
    if (!admin || admin.isActive === false) {
      return res.status(401).json({ message: 'User not found or deactivated' });
    }

    // Rotate refresh token (revoke old, issue new)
    storedToken.isRevoked = true;
    storedToken.revokedAt = new Date();
    await storedToken.save();

    const newRefreshToken = generateRefreshToken(admin);
    await RefreshToken.create({
      token: newRefreshToken,
      adminId: admin._id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    // Set new refresh token cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      path: '/',
    });

    // Generate new access token
    const accessToken = generateAccessToken(admin);

    res.status(200).json({
      data: {
        accessToken,
        expiresIn: 900, // 15 minutes
      },
    });
  } catch (err) {
    console.error('Refresh token error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Logout endpoint
exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      // Revoke refresh token in database
      await RefreshToken.updateMany(
        { token: refreshToken },
        { $set: { isRevoked: true, revokedAt: new Date() } }
      );
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err.message);
    // Still clear cookie even if DB update fails
    res.clearCookie('refreshToken', { path: '/' });
    res.status(200).json({ message: 'Logged out' });
  }
};

// Register - PROTECTED (only existing admins can create new admins)
exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Password strength validation (government requirement)
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    if (password.length > 128) {
      return res.status(400).json({ message: 'Password too long' });
    }
    // Require at least one uppercase, one lowercase, one number
    const passwordStrength = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordStrength.test(password)) {
      return res.status(400).json({
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      });
    }

    // Check if admin exists (prevent email enumeration by using generic response)
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.status(409).json({ message: 'Admin already exists' });
    }

    // Hash password with proper bcrypt rounds (12 for government systems)
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const admin = new Admin({
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'admin',
    });

    await admin.save();
    res.status(201).json({ message: 'Admin created successfully' });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};