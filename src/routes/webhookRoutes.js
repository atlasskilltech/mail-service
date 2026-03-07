const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, (req, res) => webhookController.listWebhooks(req, res));
router.get('/:id', authenticate, (req, res) => webhookController.getWebhook(req, res));
router.post('/', authenticate, (req, res) => webhookController.createWebhook(req, res));
router.put('/:id', authenticate, (req, res) => webhookController.updateWebhook(req, res));
router.delete('/:id', authenticate, (req, res) => webhookController.deleteWebhook(req, res));
router.post('/:id/test', authenticate, (req, res) => webhookController.testWebhook(req, res));

module.exports = router;
