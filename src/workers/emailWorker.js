require('dotenv').config();
const config = require('../config');
const queueService = require('../services/queueService');
const sesService = require('../services/sesService');
const EmailLog = require('../models/emailLog');
const Campaign = require('../models/campaign');
const logger = require('../utils/logger');

class EmailWorker {
  constructor() {
    this.isRunning = false;
    this.activeMessages = 0;
    this.processedCount = 0;
    this.failedCount = 0;
  }

  async start() {
    this.isRunning = true;
    logger.info('Email worker started', {
      pollInterval: config.worker.pollInterval,
      maxMessages: config.worker.maxMessages,
      retryAttempts: config.worker.retryAttempts
    });

    while (this.isRunning) {
      try {
        await this.pollMessages();
      } catch (error) {
        logger.error('Worker poll error:', error);
        await this.sleep(config.worker.pollInterval * 2);
        continue;
      }

      await this.sleep(config.worker.pollInterval);
    }

    logger.info('Email worker stopped', {
      processed: this.processedCount,
      failed: this.failedCount
    });
  }

  async pollMessages() {
    const messages = await queueService.receiveMessages();

    if (messages.length === 0) return;

    logger.info(`Processing ${messages.length} messages`);

    const processingPromises = messages.map((message) => this.processMessage(message));
    await Promise.allSettled(processingPromises);
  }

  async processMessage(message) {
    this.activeMessages++;
    let emailData;

    try {
      emailData = JSON.parse(message.Body);
    } catch (error) {
      logger.error('Invalid message body, discarding:', message.Body);
      await queueService.deleteMessage(message.ReceiptHandle);
      this.activeMessages--;
      return;
    }

    const { logId, to, subject, html, text, from, replyTo } = emailData;

    try {
      const messageId = await sesService.sendEmail({ to, subject, html, text, from, replyTo });

      if (logId) {
        await EmailLog.updateStatus(logId, 'sent', { messageId });

        // Update campaign recipient status from 'queued' to 'sent' (with retry)
        await this.updateCampaignRecipientSent(logId);
      }

      await queueService.deleteMessage(message.ReceiptHandle);

      this.processedCount++;
      logger.info(`Email sent successfully: logId=${logId}, sesMessageId=${messageId}`);
    } catch (error) {
      logger.error(`Failed to send email logId=${logId}:`, error.message);

      if (logId) {
        const log = await EmailLog.findById(logId);

        if (log && log.retry_count < config.worker.retryAttempts) {
          await EmailLog.incrementRetry(logId);
          await EmailLog.updateStatus(logId, 'pending', { errorMessage: error.message });
          logger.info(`Email logId=${logId} will be retried (attempt ${log.retry_count + 1}/${config.worker.retryAttempts})`);
        } else {
          await EmailLog.updateStatus(logId, 'failed', { errorMessage: error.message });
          await queueService.deleteMessage(message.ReceiptHandle);
          this.failedCount++;

          // Update campaign_recipients status to 'failed' on permanent failure
          try {
            const db = require('../config/database');
            const [rows] = await db.execute(
              'SELECT id, campaign_id FROM campaign_recipients WHERE email_log_id = ? AND status = ?',
              [logId, 'queued']
            );
            if (rows.length > 0) {
              const campaignId = rows[0].campaign_id;
              await Campaign.updateRecipientStatus(rows[0].id, 'failed', { errorMessage: error.message });
              await Campaign.updateCounts(campaignId);

              // Check if campaign can be completed now
              const [remaining] = await db.execute(
                "SELECT COUNT(*) as cnt FROM campaign_recipients WHERE campaign_id = ? AND status IN ('pending', 'queued')",
                [campaignId]
              );
              if (remaining[0].cnt === 0) {
                const [campRow] = await db.execute('SELECT status FROM campaigns WHERE id = ?', [campaignId]);
                if (campRow[0] && campRow[0].status === 'sending') {
                  await Campaign.updateStatus(campaignId, 'completed');
                  logger.info(`Campaign ${campaignId} completed - all recipients processed`);
                }
              }
            }
          } catch (crError) {
            logger.error(`Failed to update campaign recipient for failed logId=${logId}:`, crError.message);
          }

          logger.error(`Email logId=${logId} permanently failed after ${config.worker.retryAttempts} retries`);
        }
      }
    } finally {
      this.activeMessages--;
    }
  }

  async stop() {
    this.isRunning = false;
    logger.info('Email worker shutting down, waiting for active messages...');

    const maxWait = 30000;
    const start = Date.now();
    while (this.activeMessages > 0 && Date.now() - start < maxWait) {
      await this.sleep(500);
    }

    if (this.activeMessages > 0) {
      logger.warn(`Force stopping with ${this.activeMessages} active messages`);
    }
  }

  /**
   * Update campaign_recipients status from 'queued' to 'sent' with retry logic.
   * This is critical - if it fails silently, recipients get stuck in 'queued' forever.
   */
  async updateCampaignRecipientSent(logId) {
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const db = require('../config/database');
        const [rows] = await db.execute(
          'SELECT id, campaign_id FROM campaign_recipients WHERE email_log_id = ? AND status = ?',
          [logId, 'queued']
        );
        if (rows.length === 0) return; // No campaign recipient to update

        const campaignId = rows[0].campaign_id;
        await Campaign.updateRecipientStatus(rows[0].id, 'sent');
        await Campaign.updateCounts(campaignId);

        // Check if all recipients are now processed
        const [pending] = await db.execute(
          "SELECT COUNT(*) as cnt FROM campaign_recipients WHERE campaign_id = ? AND status IN ('pending', 'queued')",
          [campaignId]
        );
        if (pending[0].cnt === 0) {
          const [campRow] = await db.execute('SELECT status FROM campaigns WHERE id = ?', [campaignId]);
          if (campRow[0] && campRow[0].status === 'sending') {
            await Campaign.updateStatus(campaignId, 'completed');
            logger.info(`Campaign ${campaignId} completed - all recipients processed`);
          }
        }

        logger.info(`Campaign recipient updated to sent: logId=${logId}, campaignId=${campaignId}`);
        return;
      } catch (crError) {
        logger.error(`Failed to update campaign recipient for logId=${logId} (attempt ${attempt + 1}/${maxRetries + 1}):`, crError.message);
        if (attempt < maxRetries) await this.sleep(1000);
      }
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const worker = new EmailWorker();

async function shutdown() {
  await worker.stop();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

worker.start();

module.exports = EmailWorker;
