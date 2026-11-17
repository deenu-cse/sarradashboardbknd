const mongoose = require('mongoose');

const APPLICATION_STATUSES = ['new', 'reviewed', 'shortlisted', 'rejected'];
const GENDERS = ['male', 'female', 'other'];

// Label and file details are copied from the job at submit time, so editing or
// removing a document on the job later doesn't change what the candidate submitted.
const applicationDocumentSchema = new mongoose.Schema({
  requirement: { type: mongoose.Schema.Types.ObjectId, required: true },
  label: { type: String, required: true },
  filePath: { type: String, required: true }, // Local upload path in uploads/applications
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true }
});

const applicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  jobTitle: { type: String, required: true },
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: GENDERS, required: true },
  address: { type: String, required: true, trim: true },
  qualification: { type: String, required: true, trim: true },
  experience: { type: String, trim: true, default: '' },
  additionalInfo: { type: String, trim: true, default: '' },
  documents: [applicationDocumentSchema],
  status: { type: String, enum: APPLICATION_STATUSES, default: 'new' }
}, {
  timestamps: true,
  id: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

applicationSchema.virtual('applicationNumber').get(function () {
  return `SARRA-${this._id.toString().slice(-8).toUpperCase()}`;
});

// One application per email for each job
applicationSchema.index({ job: 1, email: 1 }, { unique: true });
applicationSchema.index({ job: 1, createdAt: -1 });
applicationSchema.index({ status: 1 });

module.exports = mongoose.model('Application', applicationSchema);
module.exports.APPLICATION_STATUSES = APPLICATION_STATUSES;
module.exports.GENDERS = GENDERS;
