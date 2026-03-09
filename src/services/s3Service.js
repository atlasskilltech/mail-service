const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

let s3Client = null;

function getClient() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: config.s3.region,
      credentials: config.aws.credentials
    });
  }
  return s3Client;
}

function getPublicUrl(key) {
  if (config.s3.cdnUrl) {
    return `${config.s3.cdnUrl.replace(/\/$/, '')}/${key}`;
  }
  return `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`;
}

function generateKey(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const name = `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`;
  return `${config.s3.prefix}${name}`;
}

async function uploadToS3(fileBuffer, originalName, mimetype) {
  const key = generateKey(originalName);
  const client = getClient();

  await client.send(new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype,
    CacheControl: 'public, max-age=31536000'
  }));

  return {
    key,
    url: getPublicUrl(key),
    filename: path.basename(key)
  };
}

async function deleteFromS3(key) {
  const client = getClient();
  await client.send(new DeleteObjectCommand({
    Bucket: config.s3.bucket,
    Key: key
  }));
}

async function listFromS3() {
  const client = getClient();
  const images = [];
  let continuationToken;

  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: config.s3.bucket,
      Prefix: config.s3.prefix,
      ContinuationToken: continuationToken
    }));

    if (res.Contents) {
      for (const obj of res.Contents) {
        const ext = path.extname(obj.Key).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
          images.push({
            key: obj.Key,
            filename: path.basename(obj.Key),
            size: obj.Size,
            uploadedAt: obj.LastModified.toISOString(),
            url: getPublicUrl(obj.Key)
          });
        }
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  images.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  return images;
}

module.exports = {
  ALLOWED_TYPES,
  MAX_FILE_SIZE,
  uploadToS3,
  deleteFromS3,
  listFromS3,
  getPublicUrl
};
