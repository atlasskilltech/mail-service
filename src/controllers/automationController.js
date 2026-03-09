const Automation = require('../models/automation');
const automationService = require('../services/automationService');
const logger = require('../utils/logger');

class AutomationController {
  async create(req, res) {
    try {
      const { name, description, triggerType, triggerConfig } = req.body;
      const id = await Automation.create({ name, description, triggerType, triggerConfig });
      const automation = await Automation.findById(id);
      res.status(201).json({ success: true, automation });
    } catch (error) {
      logger.error('Create automation error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const updated = await Automation.update(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Automation not found' });
      const automation = await Automation.findById(req.params.id);
      res.json({ success: true, automation });
    } catch (error) {
      logger.error('Update automation error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const deleted = await Automation.delete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Automation not found' });
      res.json({ success: true, message: 'Automation deleted' });
    } catch (error) {
      logger.error('Delete automation error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async findAll(req, res) {
    try {
      const { isActive } = req.query;
      const automations = await Automation.findAll({
        isActive: isActive !== undefined ? isActive === 'true' : undefined
      });
      res.json({ automations });
    } catch (error) {
      logger.error('List automations error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async findById(req, res) {
    try {
      const automation = await Automation.findById(req.params.id);
      if (!automation) return res.status(404).json({ error: 'Automation not found' });
      const steps = await Automation.getSteps(req.params.id);
      res.json({ automation, steps });
    } catch (error) {
      logger.error('Get automation error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async toggleActive(req, res) {
    try {
      const automation = await Automation.findById(req.params.id);
      if (!automation) return res.status(404).json({ error: 'Automation not found' });
      await Automation.update(req.params.id, { isActive: !automation.is_active });
      res.json({ success: true, isActive: !automation.is_active });
    } catch (error) {
      logger.error('Toggle automation error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // --- Steps ---
  async addStep(req, res) {
    try {
      const { stepOrder, actionType, config } = req.body;
      const id = await Automation.addStep(req.params.id, { stepOrder, actionType, config });
      res.status(201).json({ success: true, stepId: id });
    } catch (error) {
      logger.error('Add step error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateStep(req, res) {
    try {
      const updated = await Automation.updateStep(req.params.stepId, req.body);
      if (!updated) return res.status(404).json({ error: 'Step not found' });
      res.json({ success: true });
    } catch (error) {
      logger.error('Update step error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async deleteStep(req, res) {
    try {
      const deleted = await Automation.deleteStep(req.params.stepId);
      if (!deleted) return res.status(404).json({ error: 'Step not found' });
      res.json({ success: true });
    } catch (error) {
      logger.error('Delete step error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getSteps(req, res) {
    try {
      const steps = await Automation.getSteps(req.params.id);
      res.json({ steps });
    } catch (error) {
      logger.error('Get steps error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // --- Enrollments ---
  async enrollContact(req, res) {
    try {
      const { contactId } = req.body;
      if (!contactId) return res.status(400).json({ error: 'contactId is required' });
      const enrollmentId = await Automation.enrollContact(req.params.id, contactId);
      if (!enrollmentId) return res.status(409).json({ error: 'Contact already enrolled' });
      res.status(201).json({ success: true, enrollmentId });
    } catch (error) {
      logger.error('Enroll contact error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getEnrollments(req, res) {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      const enrollments = await Automation.getEnrollments(req.params.id, {
        status, limit: parseInt(limit), offset: parseInt(offset)
      });
      res.json({ enrollments });
    } catch (error) {
      logger.error('Get enrollments error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // --- Trigger ---
  async fireTrigger(req, res) {
    try {
      const { triggerType, contactId, data } = req.body;
      if (!triggerType || !contactId) {
        return res.status(400).json({ error: 'triggerType and contactId are required' });
      }
      const results = await automationService.fireTrigger(triggerType, { contactId, data });
      res.json({ success: true, enrollments: results });
    } catch (error) {
      logger.error('Fire trigger error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AutomationController();
