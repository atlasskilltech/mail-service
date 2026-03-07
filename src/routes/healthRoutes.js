const express = require('express');
const router = express.Router();
const db = require('../config/database');
const config = require('../config');

const startTime = Date.now();

router.get('/health', async (req, res) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: require('../../package.json').version,
    environment: config.nodeEnv,
    services: {}
  };

  try {
    const start = Date.now();
    await db.execute('SELECT 1');
    checks.services.database = { status: 'connected', responseTime: Date.now() - start };
  } catch {
    checks.services.database = { status: 'disconnected' };
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

router.get('/info', (req, res) => {
  res.json({
    name: 'mail-service',
    version: require('../../package.json').version,
    environment: config.nodeEnv,
    uptime: Math.floor((Date.now() - startTime) / 1000)
  });
});

module.exports = router;
