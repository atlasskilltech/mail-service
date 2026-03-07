const Webhook = require('../models/webhook');
const logger = require('../utils/logger');
const crypto = require('crypto');

class WebhookService {
  async trigger(event, payload) {
    try {
      const webhooks = await Webhook.findByEvent(event);
      if (webhooks.length === 0) return;

      const promises = webhooks.map(webhook => this.deliver(webhook, event, payload));
      await Promise.allSettled(promises);
    } catch (error) {
      logger.error('Webhook trigger error:', error);
    }
  }

  async deliver(webhook, event, payload) {
    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload
    });

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event
    };

    if (webhook.secret) {
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(body)
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.ok) {
        await Webhook.recordSuccess(webhook.id);
        logger.info(`Webhook delivered: ${event} -> ${webhook.url}`);
      } else {
        await Webhook.recordFailure(webhook.id);
        logger.warn(`Webhook failed (${response.status}): ${event} -> ${webhook.url}`);
      }
    } catch (error) {
      await Webhook.recordFailure(webhook.id);
      logger.error(`Webhook delivery error: ${event} -> ${webhook.url}:`, error.message);
    }
  }
}

module.exports = new WebhookService();
