const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  title: { type: String, required: true },
  image: { type: String, required: true }, // Cloudinary URL
  type: { type: String, enum: ['global', 'district'], required: true },
  district: { type: String } // Only needed if type is 'district'
}, { timestamps: true });

module.exports = mongoose.model('Gallery', gallerySchema);
