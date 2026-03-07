const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const { authenticate } = require('../middleware/auth');
const { validateTemplate } = require('../middleware/validator');

router.get('/', authenticate, (req, res) => templateController.listTemplates(req, res));
router.get('/:name', authenticate, (req, res) => templateController.getTemplate(req, res));
router.post('/', authenticate, validateTemplate, (req, res) => templateController.createTemplate(req, res));
router.put('/:id', authenticate, (req, res) => templateController.updateTemplate(req, res));
router.delete('/:id', authenticate, (req, res) => templateController.deleteTemplate(req, res));

module.exports = router;
