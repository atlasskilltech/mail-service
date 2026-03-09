const { generateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const ALLOWED_EMAIL = 'tech@atlasuniversity.edu.in';

async function login(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (email.toLowerCase() !== ALLOWED_EMAIL) {
      return res.status(403).json({ error: 'Unauthorized email address' });
    }

    const token = generateToken({ email: email.toLowerCase(), role: 'admin' });

    logger.info(`Login successful for ${email}`);

    res.json({
      message: 'Login successful',
      token,
      email: email.toLowerCase()
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
}

module.exports = { login };
