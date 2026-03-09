const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');
const { authenticate } = require('../middleware/auth');
const { validateAutomation, validateAutomationStep } = require('../middleware/validator');

// All automation routes require authentication
router.use(authenticate);

// CRUD
router.get('/', (req, res) => automationController.findAll(req, res));
router.get('/:id', (req, res) => automationController.findById(req, res));
router.post('/', validateAutomation, (req, res) => automationController.create(req, res));
router.put('/:id', (req, res) => automationController.update(req, res));
router.delete('/:id', (req, res) => automationController.delete(req, res));

// Toggle active
router.patch('/:id/toggle', (req, res) => automationController.toggleActive(req, res));

// Steps
router.get('/:id/steps', (req, res) => automationController.getSteps(req, res));
router.post('/:id/steps', validateAutomationStep, (req, res) => automationController.addStep(req, res));
router.put('/:id/steps/:stepId', (req, res) => automationController.updateStep(req, res));
router.delete('/:id/steps/:stepId', (req, res) => automationController.deleteStep(req, res));

// Enrollments
router.get('/:id/enrollments', (req, res) => automationController.getEnrollments(req, res));
router.post('/:id/enroll', (req, res) => automationController.enrollContact(req, res));

// Fire trigger
router.post('/trigger', (req, res) => automationController.fireTrigger(req, res));

module.exports = router;
