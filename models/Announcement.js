const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String },
  description: { type: String, required: true },
  image: { type: String }, // Cloudinary URL
  date: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

announcementSchema.pre('save', function () {
  if (this.isModified('title') || !this.slug) {
    if (this.title) {
      this.slug = this.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      this.slug += '-' + this._id.toString().slice(-6);
    } else {
      this.slug = 'announcement-' + this._id.toString().slice(-6);
    }
  }
});

module.exports = mongoose.model('Announcement', announcementSchema);
