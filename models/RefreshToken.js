const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
  expiresAt: { type: Date, required: true },
  isRevoked: { type: Boolean, default: false, index: true },
  revokedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  userAgent: { type: String }, // Browser/client info
  ip: { type: String },
});

// Auto-delete expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for cleanup queries
refreshTokenSchema.index({ adminId: 1, isRevoked: 1 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);