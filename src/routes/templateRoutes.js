const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const { authenticate } = require('../middleware/auth');
const { validateTemplate } = require('../middleware/validator');

// List & search templates
router.get('/', authenticate, (req, res) => templateController.listTemplates(req, res));

// Export all templates
router.get('/export', authenticate, (req, res) => templateController.exportTemplates(req, res));

// Import templates
router.post('/import', authenticate, (req, res) => templateController.importTemplates(req, res));

// Render inline (no saved template needed)
router.post('/render', authenticate, (req, res) => templateController.renderInline(req, res));

// Get template by name
router.get('/:name', authenticate, (req, res) => templateController.getTemplate(req, res));

// Preview template with sample data
router.post('/:name/preview', authenticate, (req, res) => templateController.previewTemplate(req, res));

// Get template usage stats
router.get('/:name/stats', authenticate, (req, res) => templateController.getTemplateStats(req, res));

// Create template
router.post('/', authenticate, validateTemplate, (req, res) => templateController.createTemplate(req, res));

// Update template
router.put('/:id', authenticate, (req, res) => templateController.updateTemplate(req, res));

// Clone template
router.post('/:id/clone', authenticate, (req, res) => templateController.cloneTemplate(req, res));

// Toggle active/inactive
router.patch('/:id/toggle', authenticate, (req, res) => templateController.toggleActive(req, res));

// Delete template
router.delete('/:id', authenticate, (req, res) => templateController.deleteTemplate(req, res));

module.exports = router;
