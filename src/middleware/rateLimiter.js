const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter rate limiter for email sending
const emailSendLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50,
  message: { error: 'Email send rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false
});

// Bulk email rate limiter
const bulkEmailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Bulk email rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { apiLimiter, emailSendLimiter, bulkEmailLimiter };
