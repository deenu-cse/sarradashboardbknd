const mongoose = require('mongoose');

const communityEngagementSchema = new mongoose.Schema({
  title: { type: String, default: 'Community Engagement' },
  description: { type: String, required: true, trim: true },
  image: { type: String, required: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('CommunityEngagement', communityEngagementSchema);
