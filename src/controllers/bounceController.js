const Bounce = require('../models/bounce');
const EmailLog = require('../models/emailLog');
const logger = require('../utils/logger');

class BounceController {
  async getAllBounces(req, res) {
    try {
      const limit = parseInt(req.query.limit || '50', 10);
      const offset = parseInt(req.query.offset || '0', 10);
      const bounceType = req.query.type || null;
      const sort = req.query.sort === 'oldest' ? 'ASC' : 'DESC';

      const result = await Bounce.findAll({ limit, offset, bounceType, sort });
      res.json({ ...result, limit, offset });
    } catch (error) {
      logger.error('Get all bounces error:', error);
      res.status(500).json({ error: 'Failed to get bounces' });
    }
  }

  async getBouncesForEmail(req, res) {
    try {
      const { email } = req.params;
      const limit = parseInt(req.query.limit || '50', 10);
      const offset = parseInt(req.query.offset || '0', 10);
      const bounces = await Bounce.findByEmail(email, { limit, offset });
      res.json({ bounces, limit, offset });
    } catch (error) {
      logger.error('Get bounces error:', error);
      res.status(500).json({ error: 'Failed to get bounces' });
    }
  }

  async getBounceStats(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const end = endDate || new Date().toISOString();
      const stats = await Bounce.getStats(start, end);
      res.json({ startDate: start, endDate: end, stats });
    } catch (error) {
      logger.error('Get bounce stats error:', error);
      res.status(500).json({ error: 'Failed to get bounce stats' });
    }
  }

  async getSuppressionList(req, res) {
    try {
      const limit = parseInt(req.query.limit || '100', 10);
      const offset = parseInt(req.query.offset || '0', 10);
      const result = await Bounce.getSuppressionList(limit, offset);
      res.json({ ...result, limit, offset });
    } catch (error) {
      logger.error('Get suppression list error:', error);
      res.status(500).json({ error: 'Failed to get suppression list' });
    }
  }

  async addToSuppressionList(req, res) {
    try {
      const { email, reason = 'manual', notes } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      await Bounce.addToSuppressionList(email, reason, notes);
      res.status(201).json({ message: `${email} added to suppression list` });
    } catch (error) {
      logger.error('Add to suppression error:', error);
      res.status(500).json({ error: 'Failed to add to suppression list' });
    }
  }

  async removeFromSuppressionList(req, res) {
    try {
      const { email } = req.params;
      const removed = await Bounce.removeFromSuppressionList(email);
      if (!removed) {
        return res.status(404).json({ error: `${email} not found in suppression list` });
      }
      res.json({ message: `${email} removed from suppression list` });
    } catch (error) {
      logger.error('Remove from suppression error:', error);
      res.status(500).json({ error: 'Failed to remove from suppression list' });
    }
  }

  async handleSNSNotification(req, res) {
    try {
      const message = req.body;

      if (message.Type === 'SubscriptionConfirmation') {
        logger.info('SNS subscription confirmation received. SubscribeURL:', message.SubscribeURL);
        res.status(200).json({ message: 'Subscription confirmation received' });
        return;
      }

      if (message.Type === 'Notification') {
        const notification = JSON.parse(message.Message);
        await this.processNotification(notification);
      }

      res.status(200).json({ message: 'Notification processed' });
    } catch (error) {
      logger.error('SNS notification error:', error);
      res.status(500).json({ error: 'Failed to process notification' });
    }
  }

  async processNotification(notification) {
    const notificationType = notification.notificationType;

    if (notificationType === 'Bounce') {
      const bounce = notification.bounce;
      for (const recipient of bounce.bouncedRecipients) {
        await Bounce.create({
          email: recipient.emailAddress,
          bounceType: bounce.bounceType === 'Permanent' ? 'hard' : 'soft',
          bounceSubtype: bounce.bounceSubType,
          originalMessageId: notification.mail?.messageId,
          diagnosticCode: recipient.diagnosticCode || null,
          feedback: JSON.stringify(recipient)
        });

        if (bounce.bounceType === 'Permanent') {
          await Bounce.addToSuppressionList(recipient.emailAddress, 'hard_bounce');
          logger.warn(`Hard bounce: ${recipient.emailAddress} added to suppression list`);
        }
      }

      if (notification.mail?.messageId) {
        const log = await EmailLog.findByMessageId(notification.mail.messageId);
        if (log) {
          await EmailLog.updateStatus(log.id, 'bounced');
        }
      }
    } else if (notificationType === 'Complaint') {
      const complaint = notification.complaint;
      for (const recipient of complaint.complainedRecipients) {
        await Bounce.create({
          email: recipient.emailAddress,
          bounceType: 'complaint',
          originalMessageId: notification.mail?.messageId,
          feedback: JSON.stringify(complaint)
        });

        await Bounce.addToSuppressionList(recipient.emailAddress, 'complaint');
        logger.warn(`Complaint: ${recipient.emailAddress} added to suppression list`);
      }
    }
  }
}

module.exports = new BounceController();
