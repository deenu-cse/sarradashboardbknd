const mongoose = require('mongoose');

const trenchPondSchema = new mongoose.Schema({
  image: { type: String, required: true }, // Local upload URL
  label: { type: String } // Optional label/caption for the image
}, { timestamps: true });

module.exports = mongoose.model('TrenchPond', trenchPondSchema);
