const Bounce = require('../models/bounce');
const logger = require('../utils/logger');

class BounceController {
  async getBouncesForEmail(req, res) {
    try {
      const { email } = req.params;
      const bounces = await Bounce.findByEmail(email);
      res.json(bounces);
    } catch (error) {
      logger.error('Get bounces error:', error);
      res.status(500).json({ error: 'Failed to get bounces' });
    }
  }

  async getSuppressionList(req, res) {
    try {
      const limit = parseInt(req.query.limit || '100', 10);
      const offset = parseInt(req.query.offset || '0', 10);
      const list = await Bounce.getSuppressionList(limit, offset);
      res.json(list);
    } catch (error) {
      logger.error('Get suppression list error:', error);
      res.status(500).json({ error: 'Failed to get suppression list' });
    }
  }

  async removeFromSuppressionList(req, res) {
    try {
      const { email } = req.params;
      await Bounce.removeFromSuppressionList(email);
      res.json({ message: `${email} removed from suppression list` });
    } catch (error) {
      logger.error('Remove from suppression error:', error);
      res.status(500).json({ error: 'Failed to remove from suppression list' });
    }
  }

  // SNS webhook handler for bounce/complaint notifications
  async handleSNSNotification(req, res) {
    try {
      const message = req.body;

      // Handle SNS subscription confirmation
      if (message.Type === 'SubscriptionConfirmation') {
        logger.info('SNS subscription confirmation received. SubscribeURL:', message.SubscribeURL);
        res.status(200).json({ message: 'Subscription confirmation received' });
        return;
      }

      // Handle notification
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
          feedback: JSON.stringify(recipient)
        });

        // Add to suppression list for hard bounces
        if (bounce.bounceType === 'Permanent') {
          await Bounce.addToSuppressionList(recipient.emailAddress, 'hard_bounce');
          logger.warn(`Hard bounce: ${recipient.emailAddress} added to suppression list`);
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
