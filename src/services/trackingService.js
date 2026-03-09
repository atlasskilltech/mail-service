const Tracking = require('../models/tracking');
const Campaign = require('../models/campaign');
const logger = require('../utils/logger');

class TrackingService {
  /**
   * Record an open event
   */
  async recordOpen({ trackingId, campaignId, email, userAgent, ipAddress }) {
    try {
      await Tracking.recordEvent({
        trackingId,
        campaignId,
        email,
        eventType: 'open',
        userAgent,
        ipAddress
      });

      // Update campaign recipient stats
      if (campaignId) {
        const recipient = await Campaign.findRecipientByTrackingId(campaignId, email);
        if (recipient) {
          await Campaign.recordOpen(recipient.id);
        }
      }

      logger.info(`Open tracked: campaign=${campaignId}, email=${email}`);
    } catch (error) {
      logger.error('Failed to record open event:', error.message);
    }
  }

  /**
   * Record a click event
   */
  async recordClick({ trackingId, campaignId, email, linkUrl, userAgent, ipAddress }) {
    try {
      await Tracking.recordEvent({
        trackingId,
        campaignId,
        email,
        eventType: 'click',
        linkUrl,
        userAgent,
        ipAddress
      });

      // Update campaign recipient stats
      if (campaignId) {
        const recipient = await Campaign.findRecipientByTrackingId(campaignId, email);
        if (recipient) {
          await Campaign.recordClick(recipient.id);
        }
      }

      logger.info(`Click tracked: campaign=${campaignId}, email=${email}, url=${linkUrl}`);
    } catch (error) {
      logger.error('Failed to record click event:', error.message);
    }
  }

  /**
   * Handle unsubscribe from campaign
   */
  async handleUnsubscribe(campaignId, email) {
    try {
      const db = require('../config/database');
      await db.execute(
        "UPDATE contacts SET status = 'unsubscribed' WHERE email = ?",
        [email]
      );

      if (campaignId) {
        await db.execute(
          'UPDATE campaigns SET unsubscribe_count = unsubscribe_count + 1 WHERE id = ?',
          [campaignId]
        );
      }

      logger.info(`Unsubscribe: campaign=${campaignId}, email=${email}`);
      return true;
    } catch (error) {
      logger.error('Failed to process unsubscribe:', error.message);
      return false;
    }
  }
}

module.exports = new TrackingService();
