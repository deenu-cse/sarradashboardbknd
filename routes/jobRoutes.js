const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const applicationController = require('../controllers/applicationController');
const { upload, handleMulterError, uploadApplicationFiles } = require('../middleware/uploadMiddleware');
const { validateIdParam } = require('../middleware/validate.middleware');
const auth = require('../middleware/authMiddleware');

const jobPdfUpload = upload.single('pdf');

router.get('/', jobController.getJobs);
router.get('/slug/:slug', jobController.getJobBySlug);
router.get('/:id', validateIdParam, jobController.getJobById);
router.post('/', auth, jobPdfUpload, handleMulterError, jobController.createJob);
router.put('/:id', auth, validateIdParam, jobPdfUpload, handleMulterError, jobController.updateJob);
router.delete('/:id', auth, validateIdParam, jobController.deleteJob);

// Public route for candidates (rate limited in index.js)
router.post('/:id/apply', validateIdParam, applicationController.loadOpenJob, uploadApplicationFiles, applicationController.submitApplication);

module.exports = router;
