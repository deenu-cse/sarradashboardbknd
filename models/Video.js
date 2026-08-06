const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: { type: String },
  videoUrl: { type: String, required: true },
  videoId: { type: String, required: true }, // Parsed YouTube video ID
  district: { type: String } // Optional district mapping
}, { timestamps: true });

module.exports = mongoose.model('Video', videoSchema);
