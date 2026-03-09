const Campaign = require('../models/campaign');
const campaignService = require('../services/campaignService');
const logger = require('../utils/logger');

class CampaignController {
  async create(req, res) {
    try {
      const { campaignName, subject, templateId, listId, segmentId, senderEmail, replyTo, templateData, scheduledAt, tags } = req.body;
      const id = await Campaign.create({ campaignName, subject, templateId, listId, segmentId, senderEmail, replyTo, templateData, scheduledAt, tags });
      const campaign = await Campaign.findById(id);
      res.status(201).json({ success: true, campaign });
    } catch (error) {
      logger.error('Create campaign error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const campaign = await Campaign.findById(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
      if (campaign.status !== 'draft') return res.status(400).json({ error: 'Only draft campaigns can be edited' });

      await Campaign.update(req.params.id, req.body);
      const updated = await Campaign.findById(req.params.id);
      res.json({ success: true, campaign: updated });
    } catch (error) {
      logger.error('Update campaign error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const deleted = await Campaign.delete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Campaign not found or not in draft status' });
      res.json({ success: true, message: 'Campaign deleted' });
    } catch (error) {
      logger.error('Delete campaign error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async findAll(req, res) {
    try {
      const { status, limit = 50, offset = 0, search } = req.query;
      const result = await Campaign.findAll({ status, limit: parseInt(limit), offset: parseInt(offset), search });
      res.json(result);
    } catch (error) {
      logger.error('List campaigns error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async findById(req, res) {
    try {
      const campaign = await Campaign.findById(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
      res.json({ campaign });
    } catch (error) {
      logger.error('Get campaign error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async send(req, res) {
    try {
      // Derive public base URL from the request for tracking pixel/click URLs
      const requestBaseUrl = `${req.protocol}://${req.get('host')}`;
      const result = await campaignService.sendCampaign(req.params.id, { requestBaseUrl });
      res.json(result);
    } catch (error) {
      logger.error('Send campaign error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async schedule(req, res) {
    try {
      const { scheduledAt } = req.body;
      if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt is required' });
      const result = await campaignService.scheduleCampaign(req.params.id, scheduledAt);
      res.json(result);
    } catch (error) {
      logger.error('Schedule campaign error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async pause(req, res) {
    try {
      const result = await campaignService.pauseCampaign(req.params.id);
      res.json(result);
    } catch (error) {
      logger.error('Pause campaign error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async resume(req, res) {
    try {
      const requestBaseUrl = `${req.protocol}://${req.get('host')}`;
      const result = await campaignService.resumeCampaign(req.params.id, { requestBaseUrl });
      res.json(result);
    } catch (error) {
      logger.error('Resume campaign error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async cancel(req, res) {
    try {
      const result = await campaignService.cancelCampaign(req.params.id);
      res.json(result);
    } catch (error) {
      logger.error('Cancel campaign error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async duplicate(req, res) {
    try {
      const campaign = await campaignService.duplicateCampaign(req.params.id);
      res.status(201).json({ success: true, campaign });
    } catch (error) {
      logger.error('Duplicate campaign error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async getRecipients(req, res) {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      const result = await Campaign.getRecipients(req.params.id, {
        status, limit: parseInt(limit), offset: parseInt(offset)
      });
      res.json(result);
    } catch (error) {
      logger.error('Get campaign recipients error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getAnalytics(req, res) {
    try {
      const analytics = await Campaign.getAnalytics(req.params.id);
      if (!analytics) return res.status(404).json({ error: 'Campaign not found' });
      res.json({ analytics });
    } catch (error) {
      logger.error('Get campaign analytics error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async populateRecipients(req, res) {
    try {
      const result = await campaignService.populateRecipients(req.params.id);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Populate recipients error:', error);
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new CampaignController();
