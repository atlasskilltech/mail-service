const Automation = require('../models/automation');
const emailService = require('./emailService');
const logger = require('../utils/logger');

class AutomationService {
  /**
   * Check and fire automations for a trigger event
   */
  async fireTrigger(triggerType, { contactId, contact, data = {} } = {}) {
    const automations = await Automation.findByTrigger(triggerType);
    const results = [];

    for (const automation of automations) {
      try {
        // Check trigger config matches
        if (!this.matchesTriggerConfig(automation, data)) continue;

        const enrollmentId = await Automation.enrollContact(automation.id, contactId);
        if (enrollmentId) {
          results.push({ automationId: automation.id, enrollmentId });
          logger.info(`Contact ${contactId} enrolled in automation ${automation.id} (${automation.name})`);
        }
      } catch (error) {
        logger.error(`Failed to enroll contact ${contactId} in automation ${automation.id}:`, error.message);
      }
    }

    return results;
  }

  /**
   * Check if trigger data matches automation config
   */
  matchesTriggerConfig(automation, data) {
    const config = automation.trigger_config;
    if (!config) return true;

    if (config.tag && data.tag && config.tag !== data.tag) return false;
    if (config.listId && data.listId && config.listId !== data.listId) return false;
    return true;
  }

  /**
   * Process a single enrollment step
   */
  async processEnrollment(enrollment) {
    const steps = await Automation.getSteps(enrollment.automation_id);
    const currentStep = steps.find(s => s.step_order === enrollment.current_step);

    if (!currentStep) {
      await Automation.completeEnrollment(enrollment.id, enrollment.automation_id);
      return { action: 'completed' };
    }

    try {
      const result = await this.executeStep(currentStep, enrollment);

      const nextStepOrder = enrollment.current_step + 1;
      const nextStep = steps.find(s => s.step_order === nextStepOrder);

      if (!nextStep) {
        await Automation.completeEnrollment(enrollment.id, enrollment.automation_id);
        return { action: 'completed' };
      }

      // Calculate next action time based on next step type
      const nextActionAt = this.calculateNextAction(nextStep);
      await Automation.advanceEnrollment(enrollment.id, nextStepOrder, nextActionAt);
      return { action: 'advanced', nextStep: nextStepOrder };
    } catch (error) {
      logger.error(`Automation step failed: enrollment=${enrollment.id}, step=${currentStep.id}:`, error.message);
      await Automation.failEnrollment(enrollment.id);
      return { action: 'failed', error: error.message };
    }
  }

  /**
   * Execute a single automation step
   */
  async executeStep(step, enrollment) {
    const stepConfig = typeof step.config === 'string' ? JSON.parse(step.config) : step.config;

    switch (step.action_type) {
      case 'send_email':
        return this.executeSendEmail(stepConfig, enrollment);
      case 'wait':
        return { waited: true };
      case 'add_tag': {
        const db = require('../config/database');
        const [contacts] = await db.execute('SELECT tags FROM contacts WHERE id = ?', [enrollment.contact_id]);
        if (contacts[0]) {
          let tags = contacts[0].tags ? (typeof contacts[0].tags === 'string' ? JSON.parse(contacts[0].tags) : contacts[0].tags) : [];
          if (!tags.includes(stepConfig.tag)) {
            tags.push(stepConfig.tag);
            await db.execute('UPDATE contacts SET tags = ? WHERE id = ?', [JSON.stringify(tags), enrollment.contact_id]);
          }
        }
        return { tagAdded: stepConfig.tag };
      }
      case 'remove_tag': {
        const db = require('../config/database');
        const [contacts] = await db.execute('SELECT tags FROM contacts WHERE id = ?', [enrollment.contact_id]);
        if (contacts[0]) {
          let tags = contacts[0].tags ? (typeof contacts[0].tags === 'string' ? JSON.parse(contacts[0].tags) : contacts[0].tags) : [];
          tags = tags.filter(t => t !== stepConfig.tag);
          await db.execute('UPDATE contacts SET tags = ? WHERE id = ?', [JSON.stringify(tags), enrollment.contact_id]);
        }
        return { tagRemoved: stepConfig.tag };
      }
      case 'move_to_list': {
        const db = require('../config/database');
        await db.execute('INSERT IGNORE INTO list_members (list_id, contact_id) VALUES (?, ?)', [stepConfig.listId, enrollment.contact_id]);
        return { movedToList: stepConfig.listId };
      }
      case 'condition':
        return { conditionEvaluated: true };
      default:
        throw new Error(`Unknown action type: ${step.action_type}`);
    }
  }

  /**
   * Send an email as part of an automation step
   */
  async executeSendEmail(stepConfig, enrollment) {
    const db = require('../config/database');
    const [contacts] = await db.execute('SELECT * FROM contacts WHERE id = ?', [enrollment.contact_id]);
    const contact = contacts[0];
    if (!contact) throw new Error('Contact not found');
    if (contact.status !== 'subscribed') return { skipped: true, reason: 'not subscribed' };

    await emailService.sendEmail({
      to: contact.email,
      template: stepConfig.template,
      data: {
        name: contact.first_name || '',
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email,
        ...(stepConfig.data || {})
      },
      from: stepConfig.from,
      replyTo: stepConfig.replyTo
    });

    return { emailSent: true, to: contact.email };
  }

  /**
   * Calculate when the next action should fire
   */
  calculateNextAction(step) {
    const stepConfig = typeof step.config === 'string' ? JSON.parse(step.config) : step.config;

    if (step.action_type === 'wait' && stepConfig.duration) {
      const now = new Date();
      const units = { minutes: 60000, hours: 3600000, days: 86400000 };
      const ms = (stepConfig.duration || 1) * (units[stepConfig.unit] || units.hours);
      return new Date(now.getTime() + ms);
    }

    return new Date(); // Execute immediately
  }
}

module.exports = new AutomationService();
