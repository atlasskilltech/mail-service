const { SESClient, SendEmailCommand, SendRawEmailCommand } = require('@aws-sdk/client-ses');
const config = require('../config');
const logger = require('../utils/logger');

const sesClient = new SESClient({
  region: config.aws.region,
  ...(config.aws.credentials && { credentials: config.aws.credentials })
});

class SESService {
  async sendEmail({ to, subject, html, text, from = config.ses.fromEmail, replyTo, cc, bcc }) {
    const toAddresses = Array.isArray(to) ? to : [to];

    const params = {
      Source: from,
      Destination: {
        ToAddresses: toAddresses
      },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {}
      }
    };

    if (cc) {
      params.Destination.CcAddresses = Array.isArray(cc) ? cc : [cc];
    }
    if (bcc) {
      params.Destination.BccAddresses = Array.isArray(bcc) ? bcc : [bcc];
    }
    if (html) {
      params.Message.Body.Html = { Data: html, Charset: 'UTF-8' };
    }
    if (text) {
      params.Message.Body.Text = { Data: text, Charset: 'UTF-8' };
    }
    if (replyTo) {
      params.ReplyToAddresses = Array.isArray(replyTo) ? replyTo : [replyTo];
    }
    if (config.ses.configurationSet) {
      params.ConfigurationSetName = config.ses.configurationSet;
    }

    try {
      const command = new SendEmailCommand(params);
      const result = await sesClient.send(command);
      logger.info(`Email sent via SES: ${result.MessageId} to ${toAddresses.join(', ')}`);
      return result.MessageId;
    } catch (error) {
      logger.error(`SES send failed to ${toAddresses.join(', ')}:`, error.message);
      throw error;
    }
  }

  async sendRawEmail(rawMessage, from = config.ses.fromEmail) {
    const command = new SendRawEmailCommand({
      Source: from,
      RawMessage: { Data: Buffer.from(rawMessage) }
    });

    try {
      const result = await sesClient.send(command);
      logger.info(`Raw email sent via SES: ${result.MessageId}`);
      return result.MessageId;
    } catch (error) {
      logger.error('SES raw send failed:', error.message);
      throw error;
    }
  }
}

module.exports = new SESService();
