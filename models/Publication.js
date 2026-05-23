const mongoose = require('mongoose');

const publicationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String },
  coverImage: { type: String }, // Cloudinary URL
  pdfUrl: { type: String }, // Cloudinary URL
  description: { type: String },
  datePublished: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Publication', publicationSchema);
