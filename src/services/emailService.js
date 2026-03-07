const templateService = require('./templateService');
const queueService = require('./queueService');
const EmailLog = require('../models/emailLog');
const Bounce = require('../models/bounce');
const logger = require('../utils/logger');

class EmailService {
  // Send a single email (queued)
  async sendEmail({ to, subject, template, data, html, text }) {
    // Check suppression list
    const recipients = Array.isArray(to) ? to : [to];
    const suppressedEmails = [];

    for (const email of recipients) {
      const isSuppressed = await Bounce.isEmailSuppressed(email);
      if (isSuppressed) {
        suppressedEmails.push(email);
      }
    }

    if (suppressedEmails.length > 0) {
      const activeRecipients = recipients.filter((e) => !suppressedEmails.includes(e));
      if (activeRecipients.length === 0) {
        return {
          success: false,
          error: 'All recipients are on the suppression list',
          suppressed: suppressedEmails
        };
      }
      logger.warn(`Suppressed emails skipped: ${suppressedEmails.join(', ')}`);
      to = activeRecipients.length === 1 ? activeRecipients[0] : activeRecipients;
    }

    // Resolve template if specified
    let emailContent = { subject, html, text };
    if (template) {
      emailContent = await templateService.renderTemplate(template, data || {});
    }

    // Create log entry
    const logId = await EmailLog.create({
      recipient: Array.isArray(to) ? to.join(', ') : to,
      subject: emailContent.subject,
      template,
      status: 'pending',
      metadata: { data }
    });

    // Enqueue for worker processing
    try {
      const sqsMessageId = await queueService.enqueueEmail({
        logId,
        to,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        template
      });

      await EmailLog.updateStatus(logId, 'queued');

      return {
        success: true,
        logId,
        sqsMessageId,
        suppressed: suppressedEmails.length > 0 ? suppressedEmails : undefined
      };
    } catch (error) {
      await EmailLog.updateStatus(logId, 'failed', { errorMessage: error.message });
      throw error;
    }
  }

  // Send bulk emails
  async sendBulkEmail({ recipients, template, defaultData = {} }) {
    const results = [];

    for (const recipient of recipients) {
      try {
        const result = await this.sendEmail({
          to: recipient.to,
          template,
          data: { ...defaultData, ...recipient.data },
          subject: recipient.subject
        });
        results.push({ to: recipient.to, ...result });
      } catch (error) {
        results.push({ to: recipient.to, success: false, error: error.message });
      }
    }

    return {
      total: recipients.length,
      queued: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results
    };
  }

  // Send template email
  async sendTemplateEmail({ to, template, data }) {
    return this.sendEmail({ to, template, data });
  }
}

module.exports = new EmailService();
