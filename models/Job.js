const mongoose = require('mongoose');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// A document the candidate has to upload. Its _id is the upload field name in the apply form.
const jobDocumentSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true }, // e.g. Photo, Resume, Degree Certificate
  fileType: { type: String, enum: ['image', 'pdf', 'any'], required: true },
  required: { type: Boolean, default: true }
});

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, unique: true },
  description: { type: String, required: true },
  requirements: [{ type: String }],
  responsibilities: [{ type: String }],
  documents: [jobDocumentSchema],
  pdfUrl: { type: String, default: '' }, // Local upload URL for the job notification PDF
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true }
}, {
  timestamps: true,
  id: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Dates are picked as calendar days and stored as UTC midnight. Applications open at the
// start of startDate and close at the end of endDate in IST, wherever the server is hosted.
jobSchema.virtual('status').get(function () {
  const now = Date.now();
  if (now < this.startDate.getTime() - IST_OFFSET_MS) return 'upcoming';
  if (now >= this.endDate.getTime() + MS_PER_DAY - IST_OFFSET_MS) return 'closed';
  return 'open';
});

// Only set once: links to a job keep working if its title is edited later
jobSchema.pre('validate', function () {
  if (this.slug) return;

  const base = (this.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  this.slug = `${base || 'job'}-${this._id.toString().slice(-6)}`;
});

jobSchema.index({ endDate: -1, createdAt: -1 });

module.exports = mongoose.model('Job', jobSchema);
