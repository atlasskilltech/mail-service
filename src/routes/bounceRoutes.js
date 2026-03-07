const express = require('express');
const router = express.Router();
const bounceController = require('../controllers/bounceController');
const { authenticate } = require('../middleware/auth');

// SNS webhook (no auth - validated by SNS)
router.post('/sns-webhook', express.json({ type: '*/*' }), (req, res) =>
  bounceController.handleSNSNotification(req, res)
);

// Authenticated routes
router.get('/email/:email', authenticate, (req, res) =>
  bounceController.getBouncesForEmail(req, res)
);

router.get('/suppression', authenticate, (req, res) =>
  bounceController.getSuppressionList(req, res)
);

router.delete('/suppression/:email', authenticate, (req, res) =>
  bounceController.removeFromSuppressionList(req, res)
);

module.exports = router;
