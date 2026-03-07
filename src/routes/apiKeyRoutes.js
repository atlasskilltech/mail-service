const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/apiKeyController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, (req, res) => apiKeyController.listKeys(req, res));
router.get('/:id', authenticate, (req, res) => apiKeyController.getKey(req, res));
router.post('/', authenticate, (req, res) => apiKeyController.createKey(req, res));
router.put('/:id', authenticate, (req, res) => apiKeyController.updateKey(req, res));
router.patch('/:id/revoke', authenticate, (req, res) => apiKeyController.revokeKey(req, res));
router.delete('/:id', authenticate, (req, res) => apiKeyController.deleteKey(req, res));

module.exports = router;
