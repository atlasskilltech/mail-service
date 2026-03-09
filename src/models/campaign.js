const db = require('../config/database');

class Campaign {
  static async create({ campaignName, subject, templateId, listId, segmentId, senderEmail, replyTo, templateData, scheduledAt, tags }) {
    const [result] = await db.execute(
      `INSERT INTO campaigns (campaign_name, subject, template_id, list_id, segment_id, sender_email, reply_to, template_data, scheduled_at, tags, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [
        campaignName, subject, templateId || null, listId || null, segmentId || null,
        senderEmail || null, replyTo || null,
        templateData ? JSON.stringify(templateData) : null,
        scheduledAt || null,
        tags ? JSON.stringify(tags) : null
      ]
    );
    return result.insertId;
  }

  static async update(id, fields) {
    const sets = [];
    const vals = [];
    const fieldMap = {
      campaignName: 'campaign_name', subject: 'subject', templateId: 'template_id',
      listId: 'list_id', segmentId: 'segment_id', senderEmail: 'sender_email',
      replyTo: 'reply_to', scheduledAt: 'scheduled_at', status: 'status'
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (fields[key] !== undefined) {
        sets.push(`${col} = ?`);
        vals.push(fields[key]);
      }
    }
    if (fields.templateData !== undefined) {
      sets.push('template_data = ?');
      vals.push(JSON.stringify(fields.templateData));
    }
    if (fields.tags !== undefined) {
      sets.push('tags = ?');
      vals.push(JSON.stringify(fields.tags));
    }
    if (!sets.length) return false;
    vals.push(id);
    const [result] = await db.execute(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = ?`, vals);
    return result.affectedRows > 0;
  }

  static async updateStatus(id, status) {
    const extras = [];
    if (status === 'sending') extras.push('started_at = NOW()');
    if (status === 'completed') extras.push('completed_at = NOW()');
    const setClauses = [`status = ?`, ...extras];
    await db.execute(`UPDATE campaigns SET ${setClauses.join(', ')} WHERE id = ?`, [status, id]);
  }

  static async updateCounts(id) {
    await db.execute(
      `UPDATE campaigns c SET
        sent_count = (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = c.id AND status IN ('sent', 'delivered')),
        failed_count = (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = c.id AND status = 'failed'),
        bounce_count = (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = c.id AND status = 'bounced'),
        open_count = (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = c.id AND opened_at IS NOT NULL),
        click_count = (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = c.id AND clicked_at IS NOT NULL)
       WHERE c.id = ?`,
      [id]
    );
  }

  static async delete(id) {
    await db.execute('DELETE FROM campaign_recipients WHERE campaign_id = ?', [id]);
    const [result] = await db.execute('DELETE FROM campaigns WHERE id = ? AND status = ?', [id, 'draft']);
    return result.affectedRows > 0;
  }

  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM campaigns WHERE id = ?', [id]);
    const campaign = rows[0] || null;
    if (campaign) {
      if (typeof campaign.template_data === 'string') campaign.template_data = JSON.parse(campaign.template_data);
      if (typeof campaign.tags === 'string') campaign.tags = JSON.parse(campaign.tags);
    }
    return campaign;
  }

  static async findAll({ status, limit = 50, offset = 0, search } = {}) {
    let where = '1=1';
    const params = [];
    if (status) { where += ' AND status = ?'; params.push(status); }
    if (search) { where += ' AND campaign_name LIKE ?'; params.push(`%${search}%`); }

    const countParams = [...params];
    params.push(limit, offset);

    const [rows] = await db.execute(
      `SELECT * FROM campaigns WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, params
    );
    const [countRow] = await db.execute(`SELECT COUNT(*) as total FROM campaigns WHERE ${where}`, countParams);
    return { campaigns: rows, total: countRow[0].total };
  }

  static async findScheduledReady() {
    const [rows] = await db.execute(
      `SELECT * FROM campaigns WHERE status = 'scheduled' AND scheduled_at <= NOW()`
    );
    return rows;
  }

  // --- Campaign Recipients ---
  static async addRecipients(campaignId, contacts) {
    if (!contacts.length) return 0;
    let added = 0;
    for (const contact of contacts) {
      try {
        await db.execute(
          'INSERT IGNORE INTO campaign_recipients (campaign_id, contact_id, email) VALUES (?, ?, ?)',
          [campaignId, contact.id, contact.email]
        );
        added++;
      } catch (_) { /* duplicate */ }
    }
    await db.execute('UPDATE campaigns SET total_recipients = ? WHERE id = ?', [added, campaignId]);
    return added;
  }

  static async getRecipients(campaignId, { status, limit = 100, offset = 0 } = {}) {
    let where = 'cr.campaign_id = ?';
    const params = [campaignId];
    if (status) { where += ' AND cr.status = ?'; params.push(status); }
    const countParams = [...params];
    params.push(limit, offset);

    const [rows] = await db.execute(
      `SELECT cr.*, c.first_name, c.last_name FROM campaign_recipients cr
       LEFT JOIN contacts c ON cr.contact_id = c.id
       WHERE ${where} ORDER BY cr.created_at ASC LIMIT ? OFFSET ?`, params
    );
    const [countRow] = await db.execute(
      `SELECT COUNT(*) as total FROM campaign_recipients cr WHERE ${where}`, countParams
    );
    return { recipients: rows, total: countRow[0].total };
  }

  static async getRecipientsByStatus(campaignId, status, limit = 100) {
    const [rows] = await db.execute(
      `SELECT cr.*, c.first_name, c.last_name, c.tags, c.custom_fields FROM campaign_recipients cr
       LEFT JOIN contacts c ON cr.contact_id = c.id
       WHERE cr.campaign_id = ? AND cr.status = ? LIMIT ?`,
      [campaignId, status, limit]
    );
    return rows;
  }

  static async updateRecipientStatus(id, status, { emailLogId, errorMessage } = {}) {
    const sets = ['status = ?'];
    const vals = [status];
    if (emailLogId) { sets.push('email_log_id = ?'); vals.push(emailLogId); }
    if (errorMessage) { sets.push('error_message = ?'); vals.push(errorMessage); }
    if (status === 'sent') sets.push('sent_at = NOW()');
    vals.push(id);
    await db.execute(`UPDATE campaign_recipients SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  static async recordOpen(campaignRecipientId) {
    await db.execute(
      `UPDATE campaign_recipients SET open_count = open_count + 1, opened_at = COALESCE(opened_at, NOW()) WHERE id = ?`,
      [campaignRecipientId]
    );
  }

  static async recordClick(campaignRecipientId) {
    await db.execute(
      `UPDATE campaign_recipients SET click_count = click_count + 1, clicked_at = COALESCE(clicked_at, NOW()) WHERE id = ?`,
      [campaignRecipientId]
    );
  }

  static async findRecipientByTrackingId(campaignId, email) {
    const [rows] = await db.execute(
      'SELECT * FROM campaign_recipients WHERE campaign_id = ? AND email = ?',
      [campaignId, email]
    );
    return rows[0] || null;
  }

  /**
   * Recover stale-queued recipients by syncing with email_logs status.
   * If the email was already sent (per email_logs) but campaign_recipients is still 'queued',
   * update it to 'sent'. If email_logs shows 'failed', mark recipient as 'failed'.
   * Then auto-finalize the campaign if all recipients are processed.
   */
  static async recoverStaleCampaign(campaignId) {
    // Sync 'queued' recipients whose email_logs already show 'sent' or 'delivered'
    await db.execute(
      `UPDATE campaign_recipients cr
       INNER JOIN email_logs el ON cr.email_log_id = el.id
       SET cr.status = 'sent', cr.sent_at = COALESCE(cr.sent_at, NOW())
       WHERE cr.campaign_id = ? AND cr.status = 'queued' AND el.status IN ('sent', 'delivered')`,
      [campaignId]
    );

    // Sync 'queued' recipients whose email_logs show 'failed'
    await db.execute(
      `UPDATE campaign_recipients cr
       INNER JOIN email_logs el ON cr.email_log_id = el.id
       SET cr.status = 'failed', cr.error_message = COALESCE(el.error_message, 'Send failed')
       WHERE cr.campaign_id = ? AND cr.status = 'queued' AND el.status = 'failed'`,
      [campaignId]
    );

    // Mark truly orphaned queued recipients (no email_log or email_log still pending for >5 min)
    await db.execute(
      `UPDATE campaign_recipients cr
       SET cr.status = 'failed', cr.error_message = 'Delivery timeout - stuck in queue'
       WHERE cr.campaign_id = ? AND cr.status = 'queued'
       AND cr.sent_at IS NULL
       AND (cr.email_log_id IS NULL OR cr.email_log_id NOT IN (
         SELECT id FROM email_logs WHERE status IN ('pending', 'queued')
       ))
       AND cr.created_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
      [campaignId]
    );

    // Check if campaign is still 'sending' but all recipients are processed
    const [campaign] = await db.execute('SELECT status FROM campaigns WHERE id = ?', [campaignId]);
    if (campaign[0] && campaign[0].status === 'sending') {
      await Campaign.updateCounts(campaignId);
      const [remaining] = await db.execute(
        "SELECT COUNT(*) as cnt FROM campaign_recipients WHERE campaign_id = ? AND status IN ('pending', 'queued')",
        [campaignId]
      );
      if (remaining[0].cnt === 0) {
        await Campaign.updateStatus(campaignId, 'completed');
      }
    }
  }

  static async getAnalytics(campaignId) {
    // Auto-recover stale campaigns when viewing analytics
    await Campaign.recoverStaleCampaign(campaignId);

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return null;

    const [statusBreakdown] = await db.execute(
      `SELECT status, COUNT(*) as count FROM campaign_recipients WHERE campaign_id = ? GROUP BY status`,
      [campaignId]
    );

    const [openStats] = await db.execute(
      `SELECT COUNT(*) as unique_opens, SUM(open_count) as total_opens
       FROM campaign_recipients WHERE campaign_id = ? AND opened_at IS NOT NULL`,
      [campaignId]
    );

    const [clickStats] = await db.execute(
      `SELECT COUNT(*) as unique_clicks, SUM(click_count) as total_clicks
       FROM campaign_recipients WHERE campaign_id = ? AND clicked_at IS NOT NULL`,
      [campaignId]
    );

    const [hourlyOpens] = await db.execute(
      `SELECT HOUR(te.created_at) as hour, COUNT(*) as count
       FROM tracking_events te WHERE te.campaign_id = ? AND te.event_type = 'open'
       GROUP BY HOUR(te.created_at) ORDER BY hour`,
      [campaignId]
    );

    const [topLinks] = await db.execute(
      `SELECT link_url, COUNT(*) as clicks FROM tracking_events
       WHERE campaign_id = ? AND event_type = 'click' AND link_url IS NOT NULL
       GROUP BY link_url ORDER BY clicks DESC LIMIT 10`,
      [campaignId]
    );

    const total = campaign.total_recipients || 1;
    return {
      campaign_id: campaignId,
      campaign_name: campaign.campaign_name,
      status: campaign.status,
      total_recipients: campaign.total_recipients,
      sent: campaign.sent_count,
      failed: campaign.failed_count,
      bounced: campaign.bounce_count,
      unsubscribed: campaign.unsubscribe_count,
      unique_opens: openStats[0].unique_opens || 0,
      total_opens: openStats[0].total_opens || 0,
      open_rate: ((openStats[0].unique_opens || 0) / total * 100).toFixed(2),
      unique_clicks: clickStats[0].unique_clicks || 0,
      total_clicks: clickStats[0].total_clicks || 0,
      click_rate: ((clickStats[0].unique_clicks || 0) / total * 100).toFixed(2),
      bounce_rate: ((campaign.bounce_count || 0) / total * 100).toFixed(2),
      delivery_breakdown: statusBreakdown,
      hourly_opens: hourlyOpens,
      top_links: topLinks,
      started_at: campaign.started_at,
      completed_at: campaign.completed_at
    };
  }
}

module.exports = Campaign;
