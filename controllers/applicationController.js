const path = require('path');
const Job = require('../models/Job');
const Application = require('../models/Application');
const { APPLICATION_STATUSES, GENDERS } = Application;
const { deleteStoredFile, normalizeStoredFilePath } = require('../utils/cloudinaryUtils');
const { getFileUrlPath, hasValidFileSignature, APPLICATION_FILE_LABELS } = require('../middleware/uploadMiddleware');
const { validateString, validateEmail, validateObjectId, validatePagination, sanitizeString } = require('../middleware/validate.middleware');

const ALREADY_APPLIED_MESSAGE = 'You have already applied for this job with this email address.';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseCandidateInput = (body) => {
  const { fullName, email, phone, dateOfBirth, gender, address, qualification, experience, additionalInfo } = body;
  const errors = [
    validateString(fullName, 'Full name', { minLength: 2, maxLength: 100 }),
    typeof email === 'string' ? validateEmail(email.trim()) : 'Email is required',
    validateString(address, 'Address', { minLength: 5, maxLength: 500 }),
    validateString(qualification, 'Qualification', { minLength: 2, maxLength: 200 }),
    validateString(experience, 'Experience', { maxLength: 500, required: false }),
    validateString(additionalInfo, 'Additional information', { maxLength: 2000, required: false })
  ].filter(Boolean);

  if (typeof phone !== 'string' || !/^\+?[0-9][0-9\s-]{6,18}$/.test(phone.trim())) {
    errors.push('Enter a valid phone number');
  }

  const parsedDateOfBirth = new Date(dateOfBirth);
  if (typeof dateOfBirth !== 'string' || isNaN(parsedDateOfBirth.getTime()) || parsedDateOfBirth >= new Date()) {
    errors.push('Enter a valid date of birth');
  }

  if (!GENDERS.includes(gender)) {
    errors.push('Select a gender');
  }

  if (errors.length > 0) return { errors };

  return {
    errors,
    values: {
      fullName: sanitizeString(fullName),
      email: sanitizeString(email),
      phone: sanitizeString(phone),
      dateOfBirth: parsedDateOfBirth,
      gender,
      address: sanitizeString(address),
      qualification: sanitizeString(qualification),
      experience: sanitizeString(experience) || '',
      additionalInfo: sanitizeString(additionalInfo) || ''
    }
  };
};

// Runs before the upload starts, so nothing is written to disk for a missing or closed job
exports.loadOpenJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    if (job.status === 'upcoming') {
      return res.status(403).json({ message: 'Applications for this job have not opened yet.' });
    }
    if (job.status === 'closed') {
      return res.status(403).json({ message: 'The last date to apply for this job has passed.' });
    }

    req.job = job;
    next();
  } catch (err) {
    console.error('Load job error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Public route to apply for a job
exports.submitApplication = async (req, res) => {
  const { job } = req;
  const uploadedFiles = Object.values(req.files || {}).flat();
  const discardUploads = () => Promise.all(uploadedFiles.map((file) => deleteStoredFile(getFileUrlPath(file))));

  try {
    const { errors, values } = parseCandidateInput(req.body);

    const documents = [];
    for (const requirement of job.documents) {
      const file = req.files?.[requirement._id.toString()]?.[0];

      if (!file) {
        if (requirement.required) errors.push(`${requirement.label} is required`);
      } else if (!(await hasValidFileSignature(file))) {
        errors.push(`${requirement.label} must be ${APPLICATION_FILE_LABELS[requirement.fileType]}`);
      } else {
        documents.push({
          requirement: requirement._id,
          label: requirement.label,
          filePath: getFileUrlPath(file),
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size
        });
      }
    }

    if (errors.length > 0) {
      await discardUploads();
      return res.status(400).json({ message: errors.join(', ') });
    }

    const application = await Application.create({ ...values, job: job._id, jobTitle: job.title, documents });

    res.status(201).json({
      success: true,
      message: 'Your application has been submitted successfully.',
      data: { applicationNumber: application.applicationNumber }
    });
  } catch (err) {
    await discardUploads();
    if (err.code === 11000) {
      return res.status(409).json({ message: ALREADY_APPLIED_MESSAGE });
    }
    console.error('Submit application error:', err.message);
    res.status(500).json({ message: 'Failed to submit your application. Please try again later.' });
  }
};

// Admin route to list candidates, optionally for one job
exports.getApplications = async (req, res) => {
  try {
    const { job, status, search } = req.query;
    const { page, limit, skip } = validatePagination(req.query);

    const filter = {};
    if (job) {
      const jobError = validateObjectId(job, 'job ID');
      if (jobError) return res.status(400).json({ message: jobError });
      filter.job = job;
    }
    if (APPLICATION_STATUSES.includes(status)) {
      filter.status = status;
    }
    if (typeof search === 'string' && search.trim()) {
      const pattern = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [{ fullName: pattern }, { email: pattern }, { phone: pattern }];
    }

    const [applications, total] = await Promise.all([
      Application.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Application.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: applications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get applications error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Admin route for the application counts shown in the sidebar and on each job
exports.getApplicationStats = async (req, res) => {
  try {
    const counts = await Application.aggregate([
      {
        $group: {
          _id: '$job',
          total: { $sum: 1 },
          new: { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } }
        }
      }
    ]);

    const byJob = {};
    let newCount = 0;
    counts.forEach((count) => {
      byJob[count._id] = { total: count.total, new: count.new };
      newCount += count.new;
    });

    res.status(200).json({ success: true, data: { new: newCount, byJob } });
  } catch (err) {
    console.error('Get application stats error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getApplicationById = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    res.status(200).json({ success: true, data: application });
  } catch (err) {
    console.error('Get application error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.status(200).json({ success: true, data: application });
  } catch (err) {
    console.error('Update application status error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const findApplicationDocument = async (req) => {
  const { id, docId } = req.params;
  if (validateObjectId(docId, 'document ID')) return {};

  const application = await Application.findById(id);
  return { application, doc: application?.documents.id(docId) };
};

// Candidate documents are private, so this is the only way to read them
exports.getApplicationDocument = async (req, res) => {
  try {
    const { doc } = await findApplicationDocument(req);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const absolutePath = normalizeStoredFilePath(doc.filePath);
    res.sendFile(path.basename(absolutePath), {
      root: path.dirname(absolutePath),
      cacheControl: false,
      headers: { 'Cache-Control': 'private, no-store' }
    }, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ message: 'Document file is missing from the server' });
      }
    });
  } catch (err) {
    console.error('Get application document error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteApplicationDocument = async (req, res) => {
  try {
    const { application, doc } = await findApplicationDocument(req);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const { filePath } = doc;
    doc.deleteOne();
    await application.save();
    await deleteStoredFile(filePath);

    res.status(200).json({ success: true, data: application });
  } catch (err) {
    console.error('Delete application document error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteApplication = async (req, res) => {
  try {
    const application = await Application.findByIdAndDelete(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    await Promise.all(application.documents.map((doc) => deleteStoredFile(doc.filePath)));

    res.status(200).json({ success: true, message: 'Application deleted successfully' });
  } catch (err) {
    console.error('Delete application error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};
