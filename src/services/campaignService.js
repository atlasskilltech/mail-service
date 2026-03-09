const Campaign = require('../models/campaign');
const ContactList = require('../models/contactList');
const Tracking = require('../models/tracking');
const templateService = require('./templateService');
const queueService = require('./queueService');
const webhookService = require('./webhookService');
const Bounce = require('../models/bounce');
const EmailLog = require('../models/emailLog');
const config = require('../config');
const logger = require('../utils/logger');

class CampaignService {
  /**
   * Populate campaign recipients from the campaign's target list or segment
   */
  async populateRecipients(campaignId) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    let contacts = [];

    if (campaign.list_id) {
      const result = await ContactList.getMembers(campaign.list_id, { limit: 100000, offset: 0 });
      contacts = result.contacts.filter(c => c.status === 'subscribed');
    } else if (campaign.segment_id) {
      const segment = await ContactList.getSegmentById(campaign.segment_id);
      if (!segment) throw new Error('Segment not found');
      const conditions = typeof segment.conditions === 'string' ? JSON.parse(segment.conditions) : segment.conditions;
      const result = await ContactList.querySegment(conditions, { limit: 100000, offset: 0 });
      contacts = result.contacts.filter(c => c.status === 'subscribed');
    } else {
      throw new Error('Campaign must have a list_id or segment_id');
    }

    // Filter out suppressed emails
    const activeContacts = [];
    for (const contact of contacts) {
      const isSuppressed = await Bounce.isEmailSuppressed(contact.email);
      if (!isSuppressed) activeContacts.push(contact);
    }

    const added = await Campaign.addRecipients(campaignId, activeContacts);
    return { total: contacts.length, added, suppressed: contacts.length - activeContacts.length };
  }

  /**
   * Send a campaign immediately or schedule it
   */
  async sendCampaign(campaignId) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      throw new Error(`Campaign cannot be sent in status: ${campaign.status}`);
    }

    // Populate recipients if not already done
    const { recipients } = await Campaign.getRecipients(campaignId, { limit: 1 });
    if (recipients.length === 0) {
      await this.populateRecipients(campaignId);
    }

    await Campaign.updateStatus(campaignId, 'sending');

    webhookService.trigger('campaign.started', {
      campaignId,
      campaignName: campaign.campaign_name
    }).catch(err => logger.error('Webhook trigger error:', err));

    // Process recipients in batches
    await this.processBatch(campaignId, campaign);

    return { success: true, campaignId };
  }

  /**
   * Process a batch of pending recipients for a campaign
   */
  async processBatch(campaignId, campaign) {
    // Process all pending recipients in batches of 50
    let batch;
    do {
      batch = await Campaign.getRecipientsByStatus(campaignId, 'pending', 50);

      for (const recipient of batch) {
        try {
          await this.sendToRecipient(campaign, recipient);
        } catch (error) {
          logger.error(`Campaign ${campaignId}: Failed to queue email for ${recipient.email}:`, error.message);
          await Campaign.updateRecipientStatus(recipient.id, 'failed', { errorMessage: error.message });
        }
      }
    } while (batch.length > 0);

    // After all pending are queued, check if campaign can be completed immediately
    // (e.g., all failed to queue). Otherwise the worker will handle completion.
    const queuedRecipients = await Campaign.getRecipientsByStatus(campaignId, 'queued', 1);
    if (queuedRecipients.length === 0) {
      await Campaign.updateCounts(campaignId);
      await Campaign.updateStatus(campaignId, 'completed');

      webhookService.trigger('campaign.completed', {
        campaignId,
        campaignName: campaign.campaign_name
      }).catch(err => logger.error('Webhook trigger error:', err));
    }
  }

  /**
   * Send campaign email to a single recipient
   */
  async sendToRecipient(campaign, recipient) {
    const trackingId = Tracking.generateTrackingId();
    const baseUrl = config.tracking?.baseUrl || `http://localhost:${config.port}`;

    // Build per-recipient template data
    const recipientData = {
      ...(campaign.template_data || {}),
      name: recipient.first_name || '',
      first_name: recipient.first_name || '',
      last_name: recipient.last_name || '',
      email: recipient.email,
      unsubscribe_url: `${baseUrl}/track/unsubscribe?cid=${campaign.id}&email=${encodeURIComponent(recipient.email)}`
    };

    // Parse custom_fields and tags if present
    if (recipient.custom_fields) {
      const custom = typeof recipient.custom_fields === 'string' ? JSON.parse(recipient.custom_fields) : recipient.custom_fields;
      Object.assign(recipientData, custom);
    }

    // Get template
    const templateModel = require('../models/emailTemplate');
    const template = await templateModel.findById(campaign.template_id);
    if (!template) throw new Error('Campaign template not found');

    // Render template with recipient data
    const rendered = await templateService.renderTemplate(template.name, recipientData);

    // Inject open tracking pixel (include cid and email for campaign recipient tracking)
    const openPixelUrl = `${baseUrl}/track/open/${trackingId}?cid=${campaign.id}&email=${encodeURIComponent(recipient.email)}`;
    const trackingPixel = `<img src="${openPixelUrl}" width="1" height="1" style="display:none" alt="">`;
    let html = rendered.html || '';
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${trackingPixel}</body>`);
    } else if (html.includes('</html>')) {
      html = html.replace('</html>', `${trackingPixel}</html>`);
    } else {
      html += trackingPixel;
    }

    // Rewrite links for click tracking
    html = this.rewriteLinks(html, trackingId, baseUrl, campaign.id, recipient.email);

    // Create email log
    const logId = await EmailLog.create({
      sender: campaign.sender_email || config.ses.fromEmail,
      recipient: recipient.email,
      subject: rendered.subject || campaign.subject,
      template: template.name,
      status: 'pending',
      metadata: { campaignId: campaign.id, trackingId }
    });

    // Queue email
    await queueService.enqueueEmail({
      logId,
      to: recipient.email,
      subject: rendered.subject || campaign.subject,
      html,
      text: rendered.text,
      from: campaign.sender_email,
      replyTo: campaign.reply_to
    });

    await Campaign.updateRecipientStatus(recipient.id, 'queued', { emailLogId: logId });
  }

  /**
   * Rewrite all links in HTML to go through click tracking
   */
  rewriteLinks(html, trackingId, baseUrl, campaignId, recipientEmail) {
    return html.replace(/href="(https?:\/\/[^"]+)"/g, (match, url) => {
      // Don't rewrite unsubscribe links (already tracked)
      if (url.includes('/track/unsubscribe')) return match;
      const trackUrl = `${baseUrl}/track/click/${trackingId}?url=${encodeURIComponent(url)}&cid=${campaignId}&email=${encodeURIComponent(recipientEmail || '')}`;
      return `href="${trackUrl}"`;
    });
  }

  /**
   * Schedule a campaign for future sending
   */
  async scheduleCampaign(campaignId, scheduledAt) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.status !== 'draft') throw new Error('Only draft campaigns can be scheduled');

    // Populate recipients
    await this.populateRecipients(campaignId);

    await Campaign.update(campaignId, { scheduledAt, status: 'scheduled' });
    return { success: true, scheduledAt };
  }

  /**
   * Pause a running campaign
   */
  async pauseCampaign(campaignId) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.status !== 'sending') throw new Error('Only sending campaigns can be paused');
    await Campaign.updateStatus(campaignId, 'paused');
    return { success: true };
  }

  /**
   * Resume a paused campaign
   */
  async resumeCampaign(campaignId) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.status !== 'paused') throw new Error('Only paused campaigns can be resumed');
    await Campaign.updateStatus(campaignId, 'sending');
    await this.processBatch(campaignId, campaign);
    return { success: true };
  }

  /**
   * Cancel a campaign
   */
  async cancelCampaign(campaignId) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    if (!['draft', 'scheduled', 'sending', 'paused'].includes(campaign.status)) {
      throw new Error('Campaign cannot be cancelled');
    }
    await Campaign.updateStatus(campaignId, 'cancelled');
    return { success: true };
  }

  /**
   * Duplicate a campaign
   */
  async duplicateCampaign(campaignId) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const newId = await Campaign.create({
      campaignName: `${campaign.campaign_name} (Copy)`,
      subject: campaign.subject,
      templateId: campaign.template_id,
      listId: campaign.list_id,
      segmentId: campaign.segment_id,
      senderEmail: campaign.sender_email,
      replyTo: campaign.reply_to,
      templateData: campaign.template_data,
      tags: campaign.tags
    });

    return Campaign.findById(newId);
  }
}

module.exports = new CampaignService();
