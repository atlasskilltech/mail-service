const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/health', async (req, res) => {
  const checks = { status: 'ok', timestamp: new Date().toISOString(), services: {} };

  // Check MySQL
  try {
    await db.execute('SELECT 1');
    checks.services.database = 'connected';
  } catch {
    checks.services.database = 'disconnected';
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(checks);
});

router.get('/ready', async (req, res) => {
  try {
    await db.execute('SELECT 1');
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
});

module.exports = router;
