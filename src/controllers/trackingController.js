const trackingService = require('../services/trackingService');
const Tracking = require('../models/tracking');
const logger = require('../utils/logger');

// 1x1 transparent GIF pixel
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

class TrackingController {
  /**
   * Open tracking - serves a 1x1 pixel and records the open
   */
  async trackOpen(req, res) {
    try {
      const { trackingId } = req.params;

      // Extract campaign ID and email from the tracking_events or query params
      const { cid, email } = req.query;

      await trackingService.recordOpen({
        trackingId,
        campaignId: cid ? parseInt(cid) : null,
        email: email || 'unknown',
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      });
    } catch (error) {
      logger.error('Open tracking error:', error.message);
    }

    // Always return the pixel regardless of errors
    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': TRACKING_PIXEL.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(TRACKING_PIXEL);
  }

  /**
   * Click tracking - records the click and redirects to the target URL
   */
  async trackClick(req, res) {
    const { trackingId } = req.params;
    const { url, cid, email } = req.query;

    if (!url) return res.status(400).send('Missing URL');

    try {
      await trackingService.recordClick({
        trackingId,
        campaignId: cid ? parseInt(cid) : null,
        email: email || 'unknown',
        linkUrl: url,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      });
    } catch (error) {
      logger.error('Click tracking error:', error.message);
    }

    // Always redirect regardless of errors
    res.redirect(302, url);
  }

  /**
   * Unsubscribe handler
   */
  async unsubscribe(req, res) {
    const { cid, email } = req.query;

    if (!email) return res.status(400).send('Missing email');

    await trackingService.handleUnsubscribe(cid ? parseInt(cid) : null, email);

    // Return a simple unsubscribe confirmation page
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Unsubscribed</title>
<style>body{font-family:Helvetica,Arial,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f4f4f7;}
.card{background:#fff;border-radius:12px;padding:48px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:480px;}
h1{color:#333;margin:0 0 16px;}p{color:#666;line-height:1.6;}</style></head>
<body><div class="card"><h1>You've been unsubscribed</h1><p>You will no longer receive marketing emails from us. If this was a mistake, please contact support.</p></div></body></html>`);
  }

  /**
   * Get tracking events for a campaign
   */
  async getCampaignEvents(req, res) {
    try {
      const { eventType, limit = 100, offset = 0 } = req.query;
      const events = await Tracking.getEventsByCampaign(req.params.campaignId, {
        eventType, limit: parseInt(limit), offset: parseInt(offset)
      });
      res.json({ events });
    } catch (error) {
      logger.error('Get tracking events error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get tracking events for an email
   */
  async getEmailEvents(req, res) {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const events = await Tracking.getEventsByEmail(req.params.email, {
        limit: parseInt(limit), offset: parseInt(offset)
      });
      res.json({ events });
    } catch (error) {
      logger.error('Get email events error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get tracking stats for a campaign
   */
  async getCampaignStats(req, res) {
    try {
      const stats = await Tracking.getStats(req.params.campaignId);
      res.json({ stats });
    } catch (error) {
      logger.error('Get tracking stats error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new TrackingController();
