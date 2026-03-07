require('dotenv').config();
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const config = require('../config');
const Bounce = require('../models/bounce');
const EmailLog = require('../models/emailLog');
const logger = require('../utils/logger');

const sqsClient = new SQSClient({
  region: config.aws.region,
  ...(config.aws.credentials && { credentials: config.aws.credentials })
});

class BounceHandler {
  constructor() {
    this.isRunning = false;
    this.activeMessages = 0;
    this.processedCount = 0;
  }

  async start() {
    this.isRunning = true;
    logger.info('Bounce handler started', {
      pollInterval: config.worker.pollInterval,
      bounceQueueUrl: config.sqs.bounceQueueUrl
    });

    while (this.isRunning) {
      try {
        await this.pollMessages();
      } catch (error) {
        logger.error('Bounce handler poll error:', error);
        await this.sleep(config.worker.pollInterval * 2);
        continue;
      }

      await this.sleep(config.worker.pollInterval);
    }

    logger.info('Bounce handler stopped', { processed: this.processedCount });
  }

  async pollMessages() {
    const command = new ReceiveMessageCommand({
      QueueUrl: config.sqs.bounceQueueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20,
      VisibilityTimeout: 30
    });

    const result = await sqsClient.send(command);
    const messages = result.Messages || [];

    for (const message of messages) {
      await this.processMessage(message);
    }
  }

  async processMessage(message) {
    this.activeMessages++;
    try {
      const snsMessage = JSON.parse(message.Body);
      const notification = JSON.parse(snsMessage.Message);

      await this.handleNotification(notification);

      await sqsClient.send(new DeleteMessageCommand({
        QueueUrl: config.sqs.bounceQueueUrl,
        ReceiptHandle: message.ReceiptHandle
      }));

      this.processedCount++;
    } catch (error) {
      logger.error('Bounce message processing error:', error);
    } finally {
      this.activeMessages--;
    }
  }

  async handleNotification(notification) {
    const type = notification.notificationType;

    if (type === 'Bounce') {
      await this.handleBounce(notification);
    } else if (type === 'Complaint') {
      await this.handleComplaint(notification);
    } else {
      logger.warn(`Unknown notification type: ${type}`);
    }
  }

  async handleBounce(notification) {
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
        logger.warn(`Hard bounce: ${recipient.emailAddress} suppressed`);
      }
    }

    if (notification.mail?.messageId) {
      const log = await EmailLog.findByMessageId(notification.mail.messageId);
      if (log) {
        await EmailLog.updateStatus(log.id, 'bounced');
      }
    }
  }

  async handleComplaint(notification) {
    const complaint = notification.complaint;

    for (const recipient of complaint.complainedRecipients) {
      await Bounce.create({
        email: recipient.emailAddress,
        bounceType: 'complaint',
        originalMessageId: notification.mail?.messageId,
        feedback: JSON.stringify(complaint)
      });

      await Bounce.addToSuppressionList(recipient.emailAddress, 'complaint');
      logger.warn(`Complaint: ${recipient.emailAddress} suppressed`);
    }
  }

  async stop() {
    this.isRunning = false;
    logger.info('Bounce handler shutting down, waiting for active messages...');

    const maxWait = 30000;
    const start = Date.now();
    while (this.activeMessages > 0 && Date.now() - start < maxWait) {
      await this.sleep(500);
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const handler = new BounceHandler();

async function shutdown() {
  await handler.stop();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

handler.start();

module.exports = BounceHandler;
