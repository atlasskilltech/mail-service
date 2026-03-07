const Webhook = require('../models/webhook');
const webhookService = require('../services/webhookService');
const logger = require('../utils/logger');
const crypto = require('crypto');

class WebhookController {
  async listWebhooks(req, res) {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const webhooks = await Webhook.findAll({ activeOnly });
      // Mask secrets in response
      const masked = webhooks.map(w => ({
        ...w,
        secret: w.secret ? '***' : null
      }));
      res.json(masked);
    } catch (error) {
      logger.error('List webhooks error:', error);
      res.status(500).json({ error: 'Failed to list webhooks' });
    }
  }

  async getWebhook(req, res) {
    try {
      const webhook = await Webhook.findById(req.params.id);
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook not found' });
      }
      webhook.secret = webhook.secret ? '***' : null;
      res.json(webhook);
    } catch (error) {
      logger.error('Get webhook error:', error);
      res.status(500).json({ error: 'Failed to get webhook' });
    }
  }

  async createWebhook(req, res) {
    try {
      const { url, events, secret, isActive } = req.body;
      if (!url || !events || !Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: 'URL and events array are required' });
      }

      const validEvents = ['email.sent', 'email.delivered', 'email.failed', 'email.bounced', 'email.complained'];
      const invalidEvents = events.filter(e => !validEvents.includes(e));
      if (invalidEvents.length > 0) {
        return res.status(400).json({ error: `Invalid events: ${invalidEvents.join(', ')}`, validEvents });
      }

      // Auto-generate secret if not provided
      const webhookSecret = secret || crypto.randomBytes(32).toString('hex');
      const id = await Webhook.create({ url, events, secret: webhookSecret, isActive });

      res.status(201).json({
        message: 'Webhook created successfully',
        id,
        secret: webhookSecret,
        warning: 'Store this webhook secret securely. It will not be shown again.'
      });
    } catch (error) {
      logger.error('Create webhook error:', error);
      res.status(500).json({ error: 'Failed to create webhook' });
    }
  }

  async updateWebhook(req, res) {
    try {
      const { url, events, secret, isActive } = req.body;

      if (events) {
        const validEvents = ['email.sent', 'email.delivered', 'email.failed', 'email.bounced', 'email.complained'];
        const invalidEvents = events.filter(e => !validEvents.includes(e));
        if (invalidEvents.length > 0) {
          return res.status(400).json({ error: `Invalid events: ${invalidEvents.join(', ')}`, validEvents });
        }
      }

      const updated = await Webhook.update(req.params.id, { url, events, secret, isActive });
      if (!updated) {
        return res.status(404).json({ error: 'Webhook not found' });
      }
      res.json({ message: 'Webhook updated successfully' });
    } catch (error) {
      logger.error('Update webhook error:', error);
      res.status(500).json({ error: 'Failed to update webhook' });
    }
  }

  async deleteWebhook(req, res) {
    try {
      const deleted = await Webhook.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Webhook not found' });
      }
      res.json({ message: 'Webhook deleted successfully' });
    } catch (error) {
      logger.error('Delete webhook error:', error);
      res.status(500).json({ error: 'Failed to delete webhook' });
    }
  }

  async testWebhook(req, res) {
    try {
      const webhook = await Webhook.findById(req.params.id);
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      await webhookService.deliver(webhook, 'webhook.test', {
        message: 'This is a test webhook delivery',
        timestamp: new Date().toISOString()
      });

      res.json({ message: 'Test webhook sent' });
    } catch (error) {
      logger.error('Test webhook error:', error);
      res.status(500).json({ error: 'Failed to test webhook' });
    }
  }
}

module.exports = new WebhookController();
