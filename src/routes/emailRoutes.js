const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { authenticate } = require('../middleware/auth');
const { emailSendLimiter, bulkEmailLimiter } = require('../middleware/rateLimiter');
const { validateSendEmail, validateBulkSend } = require('../middleware/validator');

// Send single email
router.post('/send', authenticate, emailSendLimiter, validateSendEmail, (req, res) =>
  emailController.sendEmail(req, res)
);

// Send bulk emails
router.post('/send-bulk', authenticate, bulkEmailLimiter, validateBulkSend, (req, res) =>
  emailController.sendBulkEmail(req, res)
);

// Send template email
router.post('/send-template', authenticate, emailSendLimiter, validateSendEmail, (req, res) =>
  emailController.sendTemplateEmail(req, res)
);

// Get email status by ID
router.get('/status/:id', authenticate, (req, res) =>
  emailController.getEmailStatus(req, res)
);

// Get email logs by recipient
router.get('/logs', authenticate, (req, res) =>
  emailController.getEmailLogs(req, res)
);

// Get email statistics
router.get('/stats', authenticate, (req, res) =>
  emailController.getStats(req, res)
);

module.exports = router;
