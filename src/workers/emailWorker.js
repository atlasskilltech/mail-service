require('dotenv').config();
const config = require('../config');
const queueService = require('../services/queueService');
const sesService = require('../services/sesService');
const EmailLog = require('../models/emailLog');
const logger = require('../utils/logger');

class EmailWorker {
  constructor() {
    this.isRunning = false;
  }

  async start() {
    this.isRunning = true;
    logger.info('Email worker started');

    while (this.isRunning) {
      try {
        await this.pollMessages();
      } catch (error) {
        logger.error('Worker poll error:', error);
      }

      // Wait before next poll
      await this.sleep(config.worker.pollInterval);
    }
  }

  async pollMessages() {
    const messages = await queueService.receiveMessages();

    if (messages.length === 0) return;

    logger.info(`Processing ${messages.length} messages`);

    for (const message of messages) {
      await this.processMessage(message);
    }
  }

  async processMessage(message) {
    let emailData;

    try {
      emailData = JSON.parse(message.Body);
    } catch (error) {
      logger.error('Invalid message body:', message.Body);
      await queueService.deleteMessage(message.ReceiptHandle);
      return;
    }

    const { logId, to, subject, html, text } = emailData;

    try {
      // Send via SES
      const messageId = await sesService.sendEmail({ to, subject, html, text });

      // Update log with success
      if (logId) {
        await EmailLog.updateStatus(logId, 'sent', { messageId });
      }

      // Delete message from queue
      await queueService.deleteMessage(message.ReceiptHandle);

      logger.info(`Email sent successfully: logId=${logId}, sesMessageId=${messageId}`);
    } catch (error) {
      logger.error(`Failed to send email logId=${logId}:`, error.message);

      if (logId) {
        const log = await EmailLog.findById(logId);

        if (log && log.retry_count < config.worker.retryAttempts) {
          // Increment retry count, message will become visible again after visibility timeout
          await EmailLog.incrementRetry(logId);
          await EmailLog.updateStatus(logId, 'pending', { errorMessage: error.message });
          logger.info(`Email logId=${logId} will be retried (attempt ${log.retry_count + 1}/${config.worker.retryAttempts})`);
        } else {
          // Max retries exceeded, mark as failed and remove from queue
          await EmailLog.updateStatus(logId, 'failed', { errorMessage: error.message });
          await queueService.deleteMessage(message.ReceiptHandle);
          logger.error(`Email logId=${logId} permanently failed after ${config.worker.retryAttempts} retries`);
        }
      }
    }
  }

  stop() {
    this.isRunning = false;
    logger.info('Email worker stopping...');
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Start worker when run directly
const worker = new EmailWorker();

process.on('SIGINT', () => {
  worker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  worker.stop();
  process.exit(0);
});

worker.start();

module.exports = EmailWorker;
