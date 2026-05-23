/**
 * Input Validation Middleware
 * Reusable validation utilities for CERT-In compliance
 */

const mongoose = require('mongoose');

/**
 * Validates that a string field meets requirements
 */
const validateString = (value, fieldName, { minLength = 1, maxLength = 500, required = true } = {}) => {
  if (!value && required) return `${fieldName} is required`;
  if (!value && !required) return null;
  if (typeof value !== 'string') return `${fieldName} must be a string`;
  if (value.trim().length < minLength) return `${fieldName} must be at least ${minLength} characters`;
  if (value.trim().length > maxLength) return `${fieldName} must be less than ${maxLength} characters`;
  return null;
};

/**
 * Validates email format
 */
const validateEmail = (email) => {
  if (!email) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Invalid email format';
  if (email.length > 254) return 'Email too long';
  return null;
};

/**
 * Validates MongoDB ObjectId
 */
const validateObjectId = (id, fieldName = 'ID') => {
  if (!id) return `${fieldName} is required`;
  if (!mongoose.Types.ObjectId.isValid(id)) return `Invalid ${fieldName}`;
  return null;
};

/**
 * Sanitizes string input - removes potential injection characters
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  // Remove null bytes
  return str.replace(/\0/g, '').trim();
};

/**
 * Validates pagination parameters
 */
const validatePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(Math.max(1, parseInt(query.limit) || 20), 100); // Max 100 per page
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Validates URL format
 */
const validateUrl = (url, fieldName = 'URL') => {
  if (!url) return null; // URLs are often optional
  try {
    new URL(url);
    return null;
  } catch {
    return `Invalid ${fieldName} format`;
  }
};

/**
 * Middleware factory for request body validation
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        errors.push(`${rules.label || field} is required`);
        continue;
      }

      if (value && rules.type === 'string') {
        const error = validateString(value, rules.label || field, rules);
        if (error) errors.push(error);
      }

      if (value && rules.type === 'email') {
        const error = validateEmail(value);
        if (error) errors.push(error);
      }

      if (value && rules.type === 'url') {
        const error = validateUrl(value, rules.label || field);
        if (error) errors.push(error);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join(', ') });
    }

    // Sanitize all string fields
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        req.body[key] = sanitizeString(value);
      }
    }

    next();
  };
};

/**
 * Middleware to validate :id param is a valid ObjectId
 */
const validateIdParam = (req, res, next) => {
  const { id } = req.params;
  if (id && !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid ID format' });
  }
  next();
};

module.exports = {
  validateString,
  validateEmail,
  validateObjectId,
  sanitizeString,
  validatePagination,
  validateUrl,
  validateBody,
  validateIdParam,
};
