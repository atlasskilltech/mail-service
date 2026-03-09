require('dotenv').config();
const Automation = require('../models/automation');
const automationService = require('../services/automationService');
const logger = require('../utils/logger');

class AutomationWorker {
  constructor() {
    this.isRunning = false;
    this.pollInterval = parseInt(process.env.AUTOMATION_WORKER_POLL_INTERVAL || '15000', 10);
    this.processedCount = 0;
    this.failedCount = 0;
  }

  async start() {
    this.isRunning = true;
    logger.info('Automation worker started', { pollInterval: this.pollInterval });

    while (this.isRunning) {
      try {
        await this.processEnrollments();
      } catch (error) {
        logger.error('Automation worker error:', error);
      }

      await this.sleep(this.pollInterval);
    }

    logger.info('Automation worker stopped', {
      processed: this.processedCount,
      failed: this.failedCount
    });
  }

  /**
   * Process active enrollments that are ready for their next step
   */
  async processEnrollments() {
    const enrollments = await Automation.getActiveEnrollments({ limit: 50 });

    if (enrollments.length === 0) return;

    logger.info(`Processing ${enrollments.length} automation enrollments`);

    for (const enrollment of enrollments) {
      try {
        const result = await automationService.processEnrollment(enrollment);
        this.processedCount++;
        logger.info(`Automation enrollment ${enrollment.id}: ${result.action}`);
      } catch (error) {
        this.failedCount++;
        logger.error(`Failed to process enrollment ${enrollment.id}:`, error.message);
      }
    }
  }

  async stop() {
    this.isRunning = false;
    logger.info('Automation worker shutting down...');
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const worker = new AutomationWorker();

async function shutdown() {
  await worker.stop();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

worker.start();

module.exports = AutomationWorker;
