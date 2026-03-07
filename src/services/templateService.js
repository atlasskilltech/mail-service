const Handlebars = require('handlebars');
const EmailTemplate = require('../models/emailTemplate');
const logger = require('../utils/logger');

class TemplateService {
  constructor() {
    this.cache = new Map();
    this.registerHelpers();
  }

  registerHelpers() {
    Handlebars.registerHelper('uppercase', (str) => str ? str.toUpperCase() : '');
    Handlebars.registerHelper('lowercase', (str) => str ? str.toLowerCase() : '');
    Handlebars.registerHelper('capitalize', (str) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });
    Handlebars.registerHelper('formatDate', (date) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    });
    Handlebars.registerHelper('formatCurrency', (amount, currency) => {
      if (amount === undefined || amount === null) return '';
      const cur = typeof currency === 'string' ? currency : 'USD';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(amount);
    });
    Handlebars.registerHelper('ifEquals', function(a, b, options) {
      return a === b ? options.fn(this) : options.inverse(this);
    });
    Handlebars.registerHelper('currentYear', () => new Date().getFullYear());
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

  renderString(templateString, data) {
    const compiled = Handlebars.compile(templateString);
    return compiled(data);
  }

  previewTemplate(template, data) {
    const subjectTemplate = Handlebars.compile(template.subject || '');
    const htmlTemplate = Handlebars.compile(template.body_html || '');

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

  validateTemplate(templateString) {
    try {
      Handlebars.precompile(templateString);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  extractVariables(templateString) {
    const ast = Handlebars.parse(templateString);
    const variables = new Set();

    function walk(node) {
      if (node.type === 'MustacheStatement' || node.type === 'SubExpression') {
        if (node.path && node.path.original) {
          const name = node.path.original;
          // Skip built-in helpers
          if (!['if', 'unless', 'each', 'with', 'lookup', 'log',
               'uppercase', 'lowercase', 'capitalize', 'formatDate',
               'formatCurrency', 'ifEquals', 'currentYear'].includes(name)) {
            variables.add(name);
          }
        }
        if (node.params) node.params.forEach(walk);
      }
      if (node.body) node.body.forEach(walk);
      if (node.program) walk(node.program);
      if (node.inverse) walk(node.inverse);
    }

    walk(ast);
    return Array.from(variables);
  }

  async getTemplate(name) {
    if (this.cache.has(name)) {
      const cached = this.cache.get(name);
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
