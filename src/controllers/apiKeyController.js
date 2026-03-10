const ApiKey = require('../models/apiKey');
const logger = require('../utils/logger');

class ApiKeyController {
  async getActiveKey(req, res) {
    try {
      const key = await ApiKey.findFirstActive();
      if (!key) {
        return res.status(404).json({ error: 'No active API key found' });
      }
      res.json({ apiKey: key.api_key, keyName: key.key_name, id: key.id });
    } catch (error) {
      logger.error('Get active API key error:', error);
      res.status(500).json({ error: 'Failed to get active API key' });
    }
  }

  async listKeys(req, res) {
    try {
      const keys = await ApiKey.findAll();
      res.json(keys);
    } catch (error) {
      logger.error('List API keys error:', error);
      res.status(500).json({ error: 'Failed to list API keys' });
    }
  }

  async getKey(req, res) {
    try {
      const key = await ApiKey.findById(req.params.id);
      if (!key) {
        return res.status(404).json({ error: 'API key not found' });
      }
      res.json(key);
    } catch (error) {
      logger.error('Get API key error:', error);
      res.status(500).json({ error: 'Failed to get API key' });
    }
  }

  async createKey(req, res) {
    try {
      const { keyName, rateLimit, expiresAt } = req.body;
      if (!keyName) {
        return res.status(400).json({ error: 'Key name is required' });
      }
      const result = await ApiKey.create({ keyName, rateLimit, expiresAt });
      res.status(201).json({
        message: 'API key created successfully',
        ...result,
        warning: 'Store this API key securely. It will not be shown again in full.'
      });
    } catch (error) {
      logger.error('Create API key error:', error);
      res.status(500).json({ error: 'Failed to create API key' });
    }
  }

  async updateKey(req, res) {
    try {
      const { keyName, rateLimit, isActive, expiresAt } = req.body;
      const updated = await ApiKey.update(req.params.id, { keyName, rateLimit, isActive, expiresAt });
      if (!updated) {
        return res.status(404).json({ error: 'API key not found' });
      }
      res.json({ message: 'API key updated successfully' });
    } catch (error) {
      logger.error('Update API key error:', error);
      res.status(500).json({ error: 'Failed to update API key' });
    }
  }

  async revokeKey(req, res) {
    try {
      const revoked = await ApiKey.revoke(req.params.id);
      if (!revoked) {
        return res.status(404).json({ error: 'API key not found' });
      }
      res.json({ message: 'API key revoked successfully' });
    } catch (error) {
      logger.error('Revoke API key error:', error);
      res.status(500).json({ error: 'Failed to revoke API key' });
    }
  }

  async deleteKey(req, res) {
    try {
      const deleted = await ApiKey.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'API key not found' });
      }
      res.json({ message: 'API key deleted successfully' });
    } catch (error) {
      logger.error('Delete API key error:', error);
      res.status(500).json({ error: 'Failed to delete API key' });
    }
  }
}

module.exports = new ApiKeyController();
