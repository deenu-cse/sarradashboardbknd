const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format']
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    maxLength: 20
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxLength: 2000
  },
  status: {
    type: String,
    enum: ['new', 'read', 'resolved'],
    default: 'new'
  }
}, { timestamps: true });

module.exports = mongoose.model('Contact', contactSchema);
