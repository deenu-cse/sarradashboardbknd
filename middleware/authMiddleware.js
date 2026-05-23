const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Supports both Bearer token in Authorization header and httpOnly cookies
 */
module.exports = (req, res, next) => {
  try {
    let token = null;

    // Try Authorization header first (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // Also check cookie (for refresh token flow)
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user data to request
    req.userData = {
      adminId: decoded.adminId,
      email: decoded.email,
      role: decoded.role || 'admin',
    };

    next();
  } catch (error) {
    // Handle different JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

/**
 * Role-based authorization middleware factory
 * @param {string[]} allowedRoles - Array of allowed roles
 */
module.exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userData) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.userData.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};