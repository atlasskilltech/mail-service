require('dotenv').config();
const config = require('../config');
const Campaign = require('../models/campaign');
const campaignService = require('../services/campaignService');
const logger = require('../utils/logger');

class CampaignWorker {
  constructor() {
    this.isRunning = false;
    this.pollInterval = parseInt(process.env.CAMPAIGN_WORKER_POLL_INTERVAL || '10000', 10);
  }

  async start() {
    this.isRunning = true;
    logger.info('Campaign worker started', { pollInterval: this.pollInterval });

    while (this.isRunning) {
      try {
        await this.checkScheduledCampaigns();
        await this.processSendingCampaigns();
      } catch (error) {
        logger.error('Campaign worker error:', error);
      }

      await this.sleep(this.pollInterval);
    }

    logger.info('Campaign worker stopped');
  }

  /**
   * Check for campaigns that are scheduled and ready to send
   */
  async checkScheduledCampaigns() {
    const campaigns = await Campaign.findScheduledReady();

    for (const campaign of campaigns) {
      try {
        logger.info(`Starting scheduled campaign: ${campaign.id} - ${campaign.campaign_name}`);
        await campaignService.sendCampaign(campaign.id);
      } catch (error) {
        logger.error(`Failed to start scheduled campaign ${campaign.id}:`, error.message);
      }
    }
  }

  /**
   * Process campaigns that are currently sending (handle remaining batches)
   */
  async processSendingCampaigns() {
    const { campaigns } = await Campaign.findAll({ status: 'sending', limit: 10 });
    const baseUrl = config.tracking?.baseUrl || `http://localhost:${config.port}`;

    for (const campaign of campaigns) {
      try {
        await campaignService.processBatch(campaign.id, campaign, baseUrl);
      } catch (error) {
        logger.error(`Failed to process campaign batch ${campaign.id}:`, error.message);
      }
    }
  }

  async stop() {
    this.isRunning = false;
    logger.info('Campaign worker shutting down...');
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const worker = new CampaignWorker();

async function shutdown() {
  await worker.stop();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

worker.start();

module.exports = CampaignWorker;
