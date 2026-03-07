const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const config = require('../config');
const logger = require('../utils/logger');

const sqsClient = new SQSClient({
  region: config.aws.region,
  ...(config.aws.credentials && { credentials: config.aws.credentials })
});

class QueueService {
  // Send a message to the email queue
  async enqueueEmail(emailData) {
    const command = new SendMessageCommand({
      QueueUrl: config.sqs.emailQueueUrl,
      MessageBody: JSON.stringify(emailData),
      MessageAttributes: {
        emailType: {
          DataType: 'String',
          StringValue: emailData.template || 'custom'
        }
      }
    });

    try {
      const result = await sqsClient.send(command);
      logger.info(`Message queued: ${result.MessageId}`);
      return result.MessageId;
    } catch (error) {
      logger.error('Failed to enqueue email:', error);
      throw error;
    }
  }

  // Receive messages from the email queue
  async receiveMessages(maxMessages = config.worker.maxMessages) {
    const command = new ReceiveMessageCommand({
      QueueUrl: config.sqs.emailQueueUrl,
      MaxNumberOfMessages: Math.min(maxMessages, 10),
      WaitTimeSeconds: 20, // Long polling
      MessageAttributeNames: ['All'],
      VisibilityTimeout: 60
    });

    try {
      const result = await sqsClient.send(command);
      return result.Messages || [];
    } catch (error) {
      logger.error('Failed to receive messages:', error);
      throw error;
    }
  }

  // Delete a processed message
  async deleteMessage(receiptHandle) {
    const command = new DeleteMessageCommand({
      QueueUrl: config.sqs.emailQueueUrl,
      ReceiptHandle: receiptHandle
    });

    try {
      await sqsClient.send(command);
    } catch (error) {
      logger.error('Failed to delete message:', error);
      throw error;
    }
  }
}

module.exports = new QueueService();
