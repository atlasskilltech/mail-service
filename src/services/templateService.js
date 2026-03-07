const Handlebars = require('handlebars');
const EmailTemplate = require('../models/emailTemplate');
const logger = require('../utils/logger');

class TemplateService {
  constructor() {
    this.cache = new Map();
  }

  async renderTemplate(templateName, data) {
    const template = await this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    const subjectTemplate = Handlebars.compile(template.subject);
    const htmlTemplate = Handlebars.compile(template.body_html);

    const result = {
      subject: subjectTemplate(data),
      html: htmlTemplate(data)
    };

    if (template.body_text) {
      const textTemplate = Handlebars.compile(template.body_text);
      result.text = textTemplate(data);
    }

    return result;
  }

  async getTemplate(name) {
    // Check cache first
    if (this.cache.has(name)) {
      const cached = this.cache.get(name);
      // Cache for 5 minutes
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.template;
      }
      this.cache.delete(name);
    }

    const template = await EmailTemplate.findByName(name);
    if (template) {
      this.cache.set(name, { template, timestamp: Date.now() });
    }
    return template;
  }

  clearCache() {
    this.cache.clear();
    logger.info('Template cache cleared');
  }
}

module.exports = new TemplateService();
