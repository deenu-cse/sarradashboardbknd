const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { validateIdParam } = require('../middleware/validate.middleware');
const auth = require('../middleware/authMiddleware');

// ALL routes in this file are PROTECTED - candidates apply through /api/jobs/:id/apply
router.use(auth);

router.get('/', applicationController.getApplications);
router.get('/stats', applicationController.getApplicationStats);
router.get('/:id', validateIdParam, applicationController.getApplicationById);
router.patch('/:id/status', validateIdParam, applicationController.updateApplicationStatus);
router.get('/:id/documents/:docId', validateIdParam, applicationController.getApplicationDocument);
router.delete('/:id/documents/:docId', validateIdParam, applicationController.deleteApplicationDocument);
router.delete('/:id', validateIdParam, applicationController.deleteApplication);

module.exports = router;
