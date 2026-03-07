const EmailTemplate = require('../models/emailTemplate');
const templateService = require('../services/templateService');
const logger = require('../utils/logger');

class TemplateController {
  async listTemplates(req, res) {
    try {
      const activeOnly = req.query.active === 'true';
      const search = req.query.search || null;
      const sortBy = req.query.sortBy || 'name';
      const sortOrder = req.query.sortOrder || 'ASC';
      const templates = await EmailTemplate.findAll({ activeOnly, search, sortBy, sortOrder });
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

      // Validate Handlebars syntax
      const htmlCheck = templateService.validateTemplate(bodyHtml);
      if (!htmlCheck.valid) {
        return res.status(400).json({ error: 'Invalid HTML template syntax', details: htmlCheck.error });
      }
      const subjectCheck = templateService.validateTemplate(subject);
      if (!subjectCheck.valid) {
        return res.status(400).json({ error: 'Invalid subject template syntax', details: subjectCheck.error });
      }

      // Auto-detect variables if not provided
      let templateVars = variables;
      if (!templateVars || templateVars.length === 0) {
        const detectedVars = new Set([
          ...templateService.extractVariables(bodyHtml),
          ...templateService.extractVariables(subject)
        ]);
        if (bodyText) {
          templateService.extractVariables(bodyText).forEach(v => detectedVars.add(v));
        }
        if (detectedVars.size > 0) {
          templateVars = Array.from(detectedVars);
        }
      }

      const id = await EmailTemplate.create({ name, subject, bodyHtml, bodyText, variables: templateVars, description });
      templateService.clearCache();
      res.status(201).json({ id, name, variables: templateVars, message: 'Template created' });
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

      // Validate syntax if body or subject changed
      if (req.body.bodyHtml) {
        const htmlCheck = templateService.validateTemplate(req.body.bodyHtml);
        if (!htmlCheck.valid) {
          return res.status(400).json({ error: 'Invalid HTML template syntax', details: htmlCheck.error });
        }
      }
      if (req.body.subject) {
        const subjectCheck = templateService.validateTemplate(req.body.subject);
        if (!subjectCheck.valid) {
          return res.status(400).json({ error: 'Invalid subject template syntax', details: subjectCheck.error });
        }
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

  async cloneTemplate(req, res) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'New template name is required' });
      }

      const newId = await EmailTemplate.clone(id, name);
      if (!newId) {
        return res.status(404).json({ error: 'Source template not found' });
      }
      templateService.clearCache();
      res.status(201).json({ id: newId, name, message: 'Template cloned' });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Template with this name already exists' });
      }
      logger.error('Clone template error:', error);
      res.status(500).json({ error: 'Failed to clone template' });
    }
  }

  async toggleActive(req, res) {
    try {
      const { id } = req.params;
      const updated = await EmailTemplate.toggleActive(id);
      if (!updated) {
        return res.status(404).json({ error: 'Template not found' });
      }
      templateService.clearCache();
      res.json({ message: `Template ${updated.is_active ? 'activated' : 'deactivated'}`, isActive: !!updated.is_active });
    } catch (error) {
      logger.error('Toggle template error:', error);
      res.status(500).json({ error: 'Failed to toggle template status' });
    }
  }

  async previewTemplate(req, res) {
    try {
      const { name } = req.params;
      const data = req.body.data || {};

      const template = await EmailTemplate.findByName(name);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const rendered = templateService.previewTemplate(template, data);
      res.json({ template: name, ...rendered });
    } catch (error) {
      logger.error('Preview template error:', error);
      res.status(500).json({ error: 'Failed to preview template' });
    }
  }

  async renderInline(req, res) {
    try {
      const { subject, bodyHtml, bodyText, data } = req.body;

      if (!bodyHtml && !subject) {
        return res.status(400).json({ error: 'At least subject or bodyHtml is required' });
      }

      // Validate syntax
      if (bodyHtml) {
        const check = templateService.validateTemplate(bodyHtml);
        if (!check.valid) return res.status(400).json({ error: 'Invalid HTML syntax', details: check.error });
      }

      const result = {};
      if (subject) result.subject = templateService.renderString(subject, data || {});
      if (bodyHtml) result.html = templateService.renderString(bodyHtml, data || {});
      if (bodyText) result.text = templateService.renderString(bodyText, data || {});

      // Auto-detect variables
      const detectedVars = new Set();
      if (bodyHtml) templateService.extractVariables(bodyHtml).forEach(v => detectedVars.add(v));
      if (subject) templateService.extractVariables(subject).forEach(v => detectedVars.add(v));
      if (bodyText) templateService.extractVariables(bodyText).forEach(v => detectedVars.add(v));
      result.detectedVariables = Array.from(detectedVars);

      res.json(result);
    } catch (error) {
      logger.error('Render inline error:', error);
      res.status(500).json({ error: 'Failed to render template' });
    }
  }

  async getTemplateStats(req, res) {
    try {
      const { name } = req.params;
      const template = await EmailTemplate.findByName(name);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      const stats = await EmailTemplate.getUsageStats(name);
      res.json({ template: name, ...stats });
    } catch (error) {
      logger.error('Template stats error:', error);
      res.status(500).json({ error: 'Failed to get template stats' });
    }
  }

  async exportTemplates(req, res) {
    try {
      const templates = await EmailTemplate.findAll();
      const exportData = templates.map(t => ({
        name: t.name,
        subject: t.subject,
        body_html: t.body_html,
        body_text: t.body_text,
        variables: typeof t.variables === 'string' ? JSON.parse(t.variables) : t.variables,
        description: t.description,
        is_active: !!t.is_active
      }));
      res.json({ templates: exportData, exportedAt: new Date().toISOString(), count: exportData.length });
    } catch (error) {
      logger.error('Export templates error:', error);
      res.status(500).json({ error: 'Failed to export templates' });
    }
  }

  async importTemplates(req, res) {
    try {
      const { templates, overwrite = false } = req.body;
      if (!Array.isArray(templates) || templates.length === 0) {
        return res.status(400).json({ error: 'Templates array is required' });
      }

      const results = { created: 0, updated: 0, skipped: 0, errors: [] };

      for (const tpl of templates) {
        if (!tpl.name || !tpl.subject || !tpl.body_html) {
          results.errors.push({ name: tpl.name || 'unknown', error: 'Missing required fields (name, subject, body_html)' });
          continue;
        }

        try {
          const existing = await EmailTemplate.findByName(tpl.name);
          if (existing) {
            if (overwrite) {
              await EmailTemplate.update(existing.id, {
                subject: tpl.subject,
                bodyHtml: tpl.body_html,
                bodyText: tpl.body_text || null,
                variables: tpl.variables || null,
                description: tpl.description || null,
                isActive: tpl.is_active !== undefined ? tpl.is_active : true
              });
              results.updated++;
            } else {
              results.skipped++;
            }
          } else {
            await EmailTemplate.create({
              name: tpl.name,
              subject: tpl.subject,
              bodyHtml: tpl.body_html,
              bodyText: tpl.body_text || null,
              variables: tpl.variables || null,
              description: tpl.description || null
            });
            results.created++;
          }
        } catch (err) {
          results.errors.push({ name: tpl.name, error: err.message });
        }
      }

      templateService.clearCache();
      res.json({ message: 'Import complete', ...results });
    } catch (error) {
      logger.error('Import templates error:', error);
      res.status(500).json({ error: 'Failed to import templates' });
    }
  }
}

module.exports = new TemplateController();
