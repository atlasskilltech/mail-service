const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const db = require('../config/database');
const logger = require('../utils/logger');

// JWT authentication middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// API key authentication middleware
async function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  try {
    const [rows] = await db.execute(
      'SELECT * FROM api_keys WHERE api_key = ? AND is_active = 1',
      [apiKey]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.apiKeyInfo = rows[0];
    next();
  } catch (err) {
    logger.error('API key auth error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

// Combined auth: accepts either JWT or API key
function authenticate(req, res, next) {
  if (req.headers['x-api-key']) {
    return authenticateApiKey(req, res, next);
  }
  return authenticateJWT(req, res, next);
}

// Generate JWT token (utility)
function generateToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

// Generate API key (utility)
async function createApiKey(keyName, rateLimit = 100) {
  const { v4: uuidv4 } = require('uuid');
  const apiKey = `ms_${uuidv4().replace(/-/g, '')}`;
  const hashedKey = await bcrypt.hash(apiKey, 10);

  await db.execute(
    'INSERT INTO api_keys (key_name, api_key, hashed_key, rate_limit) VALUES (?, ?, ?, ?)',
    [keyName, apiKey, hashedKey, rateLimit]
  );

  return apiKey;
}

module.exports = { authenticateJWT, authenticateApiKey, authenticate, generateToken, createApiKey };
