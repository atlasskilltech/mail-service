const Tracking = require('../models/tracking');
const Campaign = require('../models/campaign');
const logger = require('../utils/logger');

class TrackingService {
  /**
   * Resolve campaign ID and email from tracking ID when not provided in query params.
   * Falls back to looking up email_logs by trackingId stored in metadata,
   * then finds the campaign_recipient via email_log_id.
   */
  async resolveTrackingContext(trackingId, campaignId, email) {
    if (campaignId && email && email !== 'unknown') {
      return { campaignId, email };
    }

    try {
      const db = require('../config/database');

      // Look up email log by trackingId in metadata
      const [logs] = await db.execute(
        "SELECT id, recipient, metadata FROM email_logs WHERE metadata LIKE ?",
        [`%${trackingId}%`]
      );

      if (logs.length > 0) {
        const log = logs[0];
        const resolvedEmail = log.recipient || email;

        // Get campaignId from metadata or from campaign_recipients
        let resolvedCampaignId = campaignId;
        if (!resolvedCampaignId && log.metadata) {
          const meta = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
          resolvedCampaignId = meta.campaignId || null;
        }

        // If still no campaignId, try campaign_recipients by email_log_id
        if (!resolvedCampaignId) {
          const [cr] = await db.execute(
            'SELECT campaign_id FROM campaign_recipients WHERE email_log_id = ?',
            [log.id]
          );
          if (cr.length > 0) resolvedCampaignId = cr[0].campaign_id;
        }

        return { campaignId: resolvedCampaignId, email: resolvedEmail };
      }
    } catch (err) {
      logger.error('Failed to resolve tracking context:', err.message);
    }

    return { campaignId, email };
  }

  /**
   * Record an open event
   */
  async recordOpen({ trackingId, campaignId, email, userAgent, ipAddress }) {
    try {
      // Resolve campaignId and email if missing from query params
      const resolved = await this.resolveTrackingContext(trackingId, campaignId, email);
      campaignId = resolved.campaignId;
      email = resolved.email;

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
          await Campaign.updateCounts(campaignId);
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
      // Resolve campaignId and email if missing from query params
      const resolved = await this.resolveTrackingContext(trackingId, campaignId, email);
      campaignId = resolved.campaignId;
      email = resolved.email;

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
          await Campaign.updateCounts(campaignId);
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
