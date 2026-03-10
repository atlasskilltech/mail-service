const express = require('express');
const router = express.Router();
const bounceController = require('../controllers/bounceController');
const { authenticate } = require('../middleware/auth');
const { validateSuppressionAdd } = require('../middleware/validator');

// SNS webhook (no auth - validated by SNS)
router.post('/sns-webhook', express.json({ type: '*/*' }), (req, res) =>
  bounceController.handleSNSNotification(req, res)
);

// Authenticated routes
router.get('/stats', authenticate, (req, res) =>
  bounceController.getBounceStats(req, res)
);

router.get('/all', authenticate, (req, res) =>
  bounceController.getAllBounces(req, res)
);

router.get('/email/:email', authenticate, (req, res) =>
  bounceController.getBouncesForEmail(req, res)
);

router.get('/suppression', authenticate, (req, res) =>
  bounceController.getSuppressionList(req, res)
);

router.post('/suppression', authenticate, validateSuppressionAdd, (req, res) =>
  bounceController.addToSuppressionList(req, res)
);

router.delete('/suppression/:email', authenticate, (req, res) =>
  bounceController.removeFromSuppressionList(req, res)
);

module.exports = router;
