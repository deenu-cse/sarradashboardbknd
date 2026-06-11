const mongoose = require('mongoose');

const newsSectionSchema = new mongoose.Schema({
  title: { type: String },
  image: { type: String },
  description: { type: String }
});

const newsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  thumbnail: { type: String },
  district_news: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
  sections: [newsSectionSchema],
  images: [{ type: String }]
}, { timestamps: true });

newsSchema.pre('save', function () {
  if (this.isModified('title') || !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    this.slug += '-' + this._id.toString().slice(-6);
  }
});

module.exports = mongoose.model('News', newsSchema);
