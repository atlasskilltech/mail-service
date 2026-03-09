const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const { authenticate } = require('../middleware/auth');

// Public tracking endpoints (no auth - called by email clients)
router.get('/open/:trackingId', (req, res) => trackingController.trackOpen(req, res));
router.get('/click/:trackingId', (req, res) => trackingController.trackClick(req, res));
router.get('/unsubscribe', (req, res) => trackingController.unsubscribe(req, res));

// Protected analytics endpoints
router.get('/campaign/:campaignId/events', authenticate, (req, res) => trackingController.getCampaignEvents(req, res));
router.get('/campaign/:campaignId/stats', authenticate, (req, res) => trackingController.getCampaignStats(req, res));
router.get('/email/:email/events', authenticate, (req, res) => trackingController.getEmailEvents(req, res));

module.exports = router;
