const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { authenticate } = require('../middleware/auth');
const { validateCampaign } = require('../middleware/validator');
const { bulkEmailLimiter } = require('../middleware/rateLimiter');

// All campaign routes require authentication
router.use(authenticate);

// CRUD
router.get('/', (req, res) => campaignController.findAll(req, res));
router.get('/:id', (req, res) => campaignController.findById(req, res));
router.post('/', validateCampaign, (req, res) => campaignController.create(req, res));
router.put('/:id', (req, res) => campaignController.update(req, res));
router.delete('/:id', (req, res) => campaignController.delete(req, res));

// Campaign actions
router.post('/:id/send', bulkEmailLimiter, (req, res) => campaignController.send(req, res));
router.post('/:id/schedule', (req, res) => campaignController.schedule(req, res));
router.post('/:id/pause', (req, res) => campaignController.pause(req, res));
router.post('/:id/resume', bulkEmailLimiter, (req, res) => campaignController.resume(req, res));
router.post('/:id/cancel', (req, res) => campaignController.cancel(req, res));
router.post('/:id/duplicate', (req, res) => campaignController.duplicate(req, res));
router.post('/:id/populate', (req, res) => campaignController.populateRecipients(req, res));

// Campaign analytics & recipients
router.get('/:id/analytics', (req, res) => campaignController.getAnalytics(req, res));
router.get('/:id/recipients', (req, res) => campaignController.getRecipients(req, res));

module.exports = router;
