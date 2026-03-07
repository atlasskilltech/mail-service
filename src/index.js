const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');
const { apiLimiter } = require('./middleware/rateLimiter');

// Routes
const emailRoutes = require('./routes/emailRoutes');
const templateRoutes = require('./routes/templateRoutes');
const bounceRoutes = require('./routes/bounceRoutes');
const healthRoutes = require('./routes/healthRoutes');
const apiKeyRoutes = require('./routes/apiKeyRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();

// Trust proxy for rate limiting behind load balancer
app.set('trust proxy', 1);

// Global middleware
app.use(cors({
  origin: config.cors.origin,
  methods: config.cors.methods
}));
app.use(express.json({ limit: '10mb' }));
app.use(apiLimiter);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/health' && req.path !== '/ready') {
      logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// API Routes
app.use('/', healthRoutes);
app.use('/email', emailRoutes);
app.use('/templates', templateRoutes);
app.use('/bounces', bounceRoutes);
app.use('/api-keys', apiKeyRoutes);
app.use('/webhooks', webhookRoutes);

// Dashboard (static files)
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  if (req.accepts('html')) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, _next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(config.port, () => {
  logger.info(`Mail service API running on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

function shutdown() {
  logger.info('Shutting down server...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.warn('Forcing shutdown');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;
