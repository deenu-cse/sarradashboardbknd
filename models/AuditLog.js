const mongoose = require('mongoose');

/**
 * AuditLog Model
 * For CERT-In compliance - 180 days retention requirement
 * Logs all security-relevant events
 */
const auditLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  userId: { type: String, index: true },
  userRole: { type: String },
  action: { type: String, required: true, index: true },
  resource: { type: String },
  resourceId: { type: String },
  ip: { type: String },
  userAgent: { type: String },
  method: { type: String },
  path: { type: String },
  result: { type: String, enum: ['success', 'failure'] },
  statusCode: { type: Number },
  details: { type: String }, // Additional context if needed
}, {
  timestamps: false,
  capped: false, // Can be changed to true with size for performance
});

// TTL index - auto-delete after 180 days (CERT-In requirement)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 15552000 });

// Indexes for common queries
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, timestamp: -1 });
auditLogSchema.index({ result: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);