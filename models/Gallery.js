const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  title: { type: String },
  image: { type: String, required: true }, // Cloudinary URL
  type: { type: String, default: 'district' },
  district: { type: String } // Only needed if type is 'district'
}, { timestamps: true });

module.exports = mongoose.model('Gallery', gallerySchema);
