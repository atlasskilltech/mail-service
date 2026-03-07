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
  }

  async start() {
    this.isRunning = true;
    logger.info('Bounce handler started');

    while (this.isRunning) {
      try {
        await this.pollMessages();
      } catch (error) {
        logger.error('Bounce handler poll error:', error);
      }

      await this.sleep(config.worker.pollInterval);
    }
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
    try {
      const snsMessage = JSON.parse(message.Body);
      const notification = JSON.parse(snsMessage.Message);

      await this.handleNotification(notification);

      // Delete processed message
      await sqsClient.send(new DeleteMessageCommand({
        QueueUrl: config.sqs.bounceQueueUrl,
        ReceiptHandle: message.ReceiptHandle
      }));
    } catch (error) {
      logger.error('Bounce message processing error:', error);
    }
  }

  async handleNotification(notification) {
    const type = notification.notificationType;

    if (type === 'Bounce') {
      await this.handleBounce(notification);
    } else if (type === 'Complaint') {
      await this.handleComplaint(notification);
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
        feedback: JSON.stringify(recipient)
      });

      if (bounce.bounceType === 'Permanent') {
        await Bounce.addToSuppressionList(recipient.emailAddress, 'hard_bounce');
        logger.warn(`Hard bounce: ${recipient.emailAddress} suppressed`);
      }

      // Update email log if we have the message ID
      if (notification.mail?.messageId) {
        const db = require('../config/database');
        await db.execute(
          'UPDATE email_logs SET status = ? WHERE message_id = ?',
          ['bounced', notification.mail.messageId]
        );
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

  stop() {
    this.isRunning = false;
    logger.info('Bounce handler stopping...');
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const handler = new BounceHandler();

process.on('SIGINT', () => { handler.stop(); process.exit(0); });
process.on('SIGTERM', () => { handler.stop(); process.exit(0); });

handler.start();

module.exports = BounceHandler;
