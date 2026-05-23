const mongoose = require('mongoose');

const tickerSchema = new mongoose.Schema({
  text: { type: String, required: true },
  link: { type: String }, // Optional link
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Ticker', tickerSchema);
