const express = require('express');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const { apiLimiter } = require('./middleware/rateLimiter');

// Routes
const emailRoutes = require('./routes/emailRoutes');
const templateRoutes = require('./routes/templateRoutes');
const bounceRoutes = require('./routes/bounceRoutes');
const healthRoutes = require('./routes/healthRoutes');

const app = express();

// Global middleware
app.use(cors());
app.use(express.json());
app.use(apiLimiter);

// Routes
app.use('/', healthRoutes);
app.use('/email', emailRoutes);
app.use('/templates', templateRoutes);
app.use('/bounces', bounceRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, _next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  logger.info(`Mail service API running on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

module.exports = app;
