const db = require('../config/database');
const crypto = require('crypto');

class Tracking {
  static generateTrackingId() {
    return crypto.randomBytes(32).toString('hex');
  }

  static async recordEvent({ trackingId, campaignId, campaignRecipientId, emailLogId, email, eventType, linkUrl, userAgent, ipAddress }) {
    const [result] = await db.execute(
      `INSERT INTO tracking_events (tracking_id, campaign_id, campaign_recipient_id, email_log_id, email, event_type, link_url, user_agent, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [trackingId, campaignId || null, campaignRecipientId || null, emailLogId || null, email, eventType, linkUrl || null, userAgent || null, ipAddress || null]
    );
    return result.insertId;
  }

  static async getEventsByEmail(email, { limit = 50, offset = 0 } = {}) {
    const [rows] = await db.execute(
      `SELECT * FROM tracking_events WHERE email = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [email, limit, offset]
    );
    return rows;
  }

  static async getEventsByCampaign(campaignId, { eventType, limit = 100, offset = 0 } = {}) {
    let where = 'campaign_id = ?';
    const params = [campaignId];
    if (eventType) { where += ' AND event_type = ?'; params.push(eventType); }
    params.push(limit, offset);

    const [rows] = await db.execute(
      `SELECT * FROM tracking_events WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, params
    );
    return rows;
  }

  static async getStats(campaignId) {
    const [rows] = await db.execute(
      `SELECT event_type, COUNT(*) as count, COUNT(DISTINCT email) as unique_count
       FROM tracking_events WHERE campaign_id = ? GROUP BY event_type`,
      [campaignId]
    );
    return rows;
  }
}

module.exports = Tracking;
