const Job = require('../models/Job');
const Application = require('../models/Application');
const { deleteStoredFile } = require('../utils/cloudinaryUtils');
const { getFileUrlPath } = require('../middleware/uploadMiddleware');
const { validateString, validatePagination, sanitizeString } = require('../middleware/validate.middleware');
const mongoose = require('mongoose');

const MAX_JOB_DOCUMENTS = 15;
const FILE_TYPES = ['image', 'pdf', 'any'];

const parseDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

// Requirements and responsibilities are entered one per line in the dashboard
const parseLines = (value) => value
  .split('\n')
  .map((line) => sanitizeString(line))
  .filter(Boolean);

const parseDocuments = (value, errors) => {
  let documents;
  try {
    documents = JSON.parse(value || '[]');
  } catch {
    documents = null;
  }

  if (!Array.isArray(documents)) {
    errors.push('Invalid documents list');
    return [];
  }
  if (documents.length > MAX_JOB_DOCUMENTS) {
    errors.push(`A job can ask for at most ${MAX_JOB_DOCUMENTS} documents`);
    return [];
  }

  const labels = new Set();
  return documents.map((doc) => {
    const label = typeof doc?.label === 'string' ? sanitizeString(doc.label) : '';
    const labelError = validateString(label, 'Document label', { maxLength: 100 });
    if (labelError) errors.push(labelError);
    if (labels.has(label.toLowerCase())) errors.push(`Document "${label}" is listed twice`);
    labels.add(label.toLowerCase());

    if (!FILE_TYPES.includes(doc?.fileType)) errors.push(`Invalid file type for document "${label}"`);

    const parsed = { label, fileType: doc?.fileType, required: doc?.required === true };
    if (mongoose.Types.ObjectId.isValid(doc?._id)) parsed._id = doc._id;
    return parsed;
  });
};

// Multipart bodies arrive after the global sanitizers have run, so fields are cleaned here
const parseJobInput = (req) => {
  const { title, description, requirements, responsibilities, documents, startDate, endDate } = req.body;
  const errors = [
    validateString(title, 'Title', { maxLength: 300 }),
    validateString(description, 'Description', { maxLength: 15000 }),
    validateString(requirements, 'Requirements', { maxLength: 15000 }),
    validateString(responsibilities, 'Responsibilities', { maxLength: 15000 })
  ].filter(Boolean);

  const parsedStartDate = parseDate(startDate);
  const parsedEndDate = parseDate(endDate);
  if (!parsedStartDate) errors.push('Start date is required');
  if (!parsedEndDate) errors.push('End date is required');
  if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
    errors.push('End date cannot be before the start date');
  }

  if (req.file && req.file.mimetype !== 'application/pdf') {
    errors.push('The job document must be a PDF');
  }

  const parsedDocuments = parseDocuments(documents, errors);
  if (errors.length > 0) return { errors };

  return {
    errors,
    values: {
      title: sanitizeString(title),
      description: sanitizeString(description),
      requirements: parseLines(requirements),
      responsibilities: parseLines(responsibilities),
      documents: parsedDocuments,
      startDate: parsedStartDate,
      endDate: parsedEndDate
    }
  };
};

exports.createJob = async (req, res) => {
  try {
    const { errors, values } = parseJobInput(req);
    if (errors.length > 0) {
      await deleteStoredFile(getFileUrlPath(req.file));
      return res.status(400).json({ message: errors.join(', ') });
    }

    const job = await Job.create({ ...values, pdfUrl: getFileUrlPath(req.file) });
    res.status(201).json(job);
  } catch (err) {
    await deleteStoredFile(getFileUrlPath(req.file));
    console.error('Create job error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getJobs = async (req, res) => {
  try {
    const { page, limit, skip } = validatePagination(req.query);

    const [jobs, total] = await Promise.all([
      Job.find().sort({ endDate: -1, createdAt: -1 }).skip(skip).limit(limit),
      Job.countDocuments()
    ]);

    res.status(200).json({
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get jobs error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getJobBySlug = async (req, res) => {
  try {
    const job = await Job.findOne({ slug: req.params.slug });
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.status(200).json(job);
  } catch (err) {
    console.error('Get job by slug error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.status(200).json(job);
  } catch (err) {
    console.error('Get job by ID error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      await deleteStoredFile(getFileUrlPath(req.file));
      return res.status(404).json({ message: 'Job not found' });
    }

    const { errors, values } = parseJobInput(req);
    if (errors.length > 0) {
      await deleteStoredFile(getFileUrlPath(req.file));
      return res.status(400).json({ message: errors.join(', ') });
    }

    job.set(values);

    // The old PDF is only removed from disk once the new state has been saved
    const replacesPdf = req.file || req.body.removePdf === 'true';
    const stalePdf = replacesPdf ? job.pdfUrl : '';
    if (replacesPdf) job.pdfUrl = getFileUrlPath(req.file);

    await job.save();
    await deleteStoredFile(stalePdf);

    res.status(200).json(job);
  } catch (err) {
    await deleteStoredFile(getFileUrlPath(req.file));
    console.error('Update job error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Removes the job, every application to it, and all of their files from disk
exports.deleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findByIdAndDelete(id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const applications = await Application.find({ job: id }).select('documents.filePath').lean();
    await Application.deleteMany({ job: id });

    const files = applications.flatMap((application) => application.documents.map((doc) => doc.filePath));
    await Promise.all([job.pdfUrl, ...files].map(deleteStoredFile));

    res.status(200).json({ message: 'Job deleted successfully' });
  } catch (err) {
    console.error('Delete job error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};
