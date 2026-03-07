const emailService = require('../services/emailService');
const EmailLog = require('../models/emailLog');
const logger = require('../utils/logger');

class EmailController {
  async sendEmail(req, res) {
    try {
      const { to, subject, template, data, html, text } = req.body;
      const result = await emailService.sendEmail({ to, subject, template, data, html, text });
      res.status(202).json(result);
    } catch (error) {
      logger.error('Send email error:', error);
      res.status(500).json({ error: 'Failed to queue email', details: error.message });
    }
  }

  async sendBulkEmail(req, res) {
    try {
      const { recipients, template, defaultData } = req.body;
      const result = await emailService.sendBulkEmail({ recipients, template, defaultData });
      res.status(202).json(result);
    } catch (error) {
      logger.error('Bulk email error:', error);
      res.status(500).json({ error: 'Failed to queue bulk email', details: error.message });
    }
  }

  async sendTemplateEmail(req, res) {
    try {
      const { to, template, data } = req.body;
      const result = await emailService.sendTemplateEmail({ to, template, data });
      res.status(202).json(result);
    } catch (error) {
      logger.error('Template email error:', error);
      res.status(500).json({ error: 'Failed to queue template email', details: error.message });
    }
  }

  async getEmailStatus(req, res) {
    try {
      const { id } = req.params;
      const log = await EmailLog.findById(id);
      if (!log) {
        return res.status(404).json({ error: 'Email log not found' });
      }
      res.json(log);
    } catch (error) {
      logger.error('Get email status error:', error);
      res.status(500).json({ error: 'Failed to get email status' });
    }
  }

  async getEmailLogs(req, res) {
    try {
      const { recipient } = req.query;
      if (!recipient) {
        return res.status(400).json({ error: 'Recipient query parameter is required' });
      }
      const logs = await EmailLog.findByRecipient(recipient);
      res.json(logs);
    } catch (error) {
      logger.error('Get email logs error:', error);
      res.status(500).json({ error: 'Failed to get email logs' });
    }
  }

  async getStats(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const end = endDate || new Date().toISOString();
      const stats = await EmailLog.getStats(start, end);
      res.json({ startDate: start, endDate: end, stats });
    } catch (error) {
      logger.error('Get stats error:', error);
      res.status(500).json({ error: 'Failed to get email stats' });
    }
  }
}

module.exports = new EmailController();
