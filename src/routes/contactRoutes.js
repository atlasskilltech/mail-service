const express = require('express');
const router = express.Router();
const multer = require('multer');
const contactController = require('../controllers/contactController');
const { authenticate } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Contacts CRUD
router.get('/', authenticate, (req, res) => contactController.listContacts(req, res));
router.get('/stats', authenticate, (req, res) => contactController.getStats(req, res));
router.get('/filters', authenticate, (req, res) => contactController.getFilterOptions(req, res));
router.get('/:id', authenticate, (req, res) => contactController.getContact(req, res));
router.post('/', authenticate, (req, res) => contactController.createContact(req, res));
router.put('/:id', authenticate, (req, res) => contactController.updateContact(req, res));
router.delete('/:id', authenticate, (req, res) => contactController.deleteContact(req, res));

// Bulk & CSV import
router.post('/import', authenticate, (req, res) => contactController.bulkImport(req, res));
router.post('/import/csv', authenticate, upload.single('file'), (req, res) => contactController.csvImport(req, res));

// Subscription
router.post('/:email/unsubscribe', authenticate, (req, res) => contactController.unsubscribe(req, res));
router.post('/:email/resubscribe', authenticate, (req, res) => contactController.resubscribe(req, res));

// Tags
router.post('/:id/tags', authenticate, (req, res) => contactController.addTag(req, res));
router.delete('/:id/tags/:tag', authenticate, (req, res) => contactController.removeTag(req, res));

module.exports = router;
