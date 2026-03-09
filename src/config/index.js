require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mail_service',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    queueLimit: 0,
    connectTimeout: 10000
  },

  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: process.env.AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      : undefined
  },

  ses: {
    fromEmail: process.env.SES_FROM_EMAIL || 'noreply@example.com',
    replyToEmail: process.env.SES_REPLY_TO_EMAIL || null,
    configurationSet: process.env.SES_CONFIGURATION_SET || null
  },

  s3: {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1',
    prefix: process.env.S3_PREFIX || 'uploads/',
    cdnUrl: process.env.S3_CDN_URL || '',  // Optional CloudFront URL
    enabled: !!process.env.S3_BUCKET
  },

  sqs: {
    emailQueueUrl: process.env.SQS_EMAIL_QUEUE_URL,
    bounceQueueUrl: process.env.SQS_BOUNCE_QUEUE_URL
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },

  worker: {
    pollInterval: parseInt(process.env.WORKER_POLL_INTERVAL || '5000', 10),
    maxMessages: parseInt(process.env.WORKER_MAX_MESSAGES || '10', 10),
    retryAttempts: parseInt(process.env.WORKER_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.WORKER_RETRY_DELAY || '30000', 10),
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10)
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS'
  },

  tracking: {
    baseUrl: process.env.TRACKING_BASE_URL || null
  }
};

module.exports = config;
