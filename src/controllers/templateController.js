const EmailTemplate = require('../models/emailTemplate');
const templateService = require('../services/templateService');
const logger = require('../utils/logger');

class TemplateController {
  async listTemplates(req, res) {
    try {
      const activeOnly = req.query.active === 'true';
      const templates = await EmailTemplate.findAll({ activeOnly });
      res.json(templates);
    } catch (error) {
      logger.error('List templates error:', error);
      res.status(500).json({ error: 'Failed to list templates' });
    }
  }

  async getTemplate(req, res) {
    try {
      const template = await EmailTemplate.findByName(req.params.name);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json(template);
    } catch (error) {
      logger.error('Get template error:', error);
      res.status(500).json({ error: 'Failed to get template' });
    }
  }

  async createTemplate(req, res) {
    try {
      const { name, subject, bodyHtml, bodyText, variables, description } = req.body;
      const id = await EmailTemplate.create({ name, subject, bodyHtml, bodyText, variables, description });
      templateService.clearCache();
      res.status(201).json({ id, name, message: 'Template created' });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Template with this name already exists' });
      }
      logger.error('Create template error:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  }

  async updateTemplate(req, res) {
    try {
      const { id } = req.params;
      const existing = await EmailTemplate.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Template not found' });
      }
      await EmailTemplate.update(id, req.body);
      templateService.clearCache();
      res.json({ message: 'Template updated' });
    } catch (error) {
      logger.error('Update template error:', error);
      res.status(500).json({ error: 'Failed to update template' });
    }
  }

  async deleteTemplate(req, res) {
    try {
      const { id } = req.params;
      const existing = await EmailTemplate.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Template not found' });
      }
      await EmailTemplate.delete(id);
      templateService.clearCache();
      res.json({ message: 'Template deleted' });
    } catch (error) {
      logger.error('Delete template error:', error);
      res.status(500).json({ error: 'Failed to delete template' });
    }
  }
}

module.exports = new TemplateController();
