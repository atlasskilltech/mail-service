const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/contactListController');
const { authenticate } = require('../middleware/auth');

// Lists CRUD
router.get('/', authenticate, (req, res) => ctrl.listAll(req, res));
router.get('/:id', authenticate, (req, res) => ctrl.getList(req, res));
router.post('/', authenticate, (req, res) => ctrl.createList(req, res));
router.put('/:id', authenticate, (req, res) => ctrl.updateList(req, res));
router.delete('/:id', authenticate, (req, res) => ctrl.deleteList(req, res));

// List members
router.get('/:id/members', authenticate, (req, res) => ctrl.getMembers(req, res));
router.post('/:id/members', authenticate, (req, res) => ctrl.addMembers(req, res));
router.delete('/:id/members/:contactId', authenticate, (req, res) => ctrl.removeMember(req, res));

// Segments
router.get('/segments/all', authenticate, (req, res) => ctrl.listSegments(req, res));
router.post('/segments', authenticate, (req, res) => ctrl.createSegment(req, res));
router.put('/segments/:id', authenticate, (req, res) => ctrl.updateSegment(req, res));
router.delete('/segments/:id', authenticate, (req, res) => ctrl.deleteSegment(req, res));
router.get('/segments/:id/query', authenticate, (req, res) => ctrl.querySegment(req, res));
router.post('/segments/preview', authenticate, (req, res) => ctrl.previewSegment(req, res));

module.exports = router;
