const fs = require('fs');
const path = require('path');
const { UPLOAD_DIR } = require('../middleware/upload');
const config = require('../config');
const logger = require('../utils/logger');

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

let s3Service;
if (config.s3.enabled) {
  s3Service = require('../services/s3Service');
}

class ImageController {
  // ─── Single Upload ───
  async uploadImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      if (config.s3.enabled) {
        const result = await s3Service.uploadToS3(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
        return res.status(201).json({
          message: 'Image uploaded to S3',
          filename: result.filename,
          key: result.key,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          url: result.url
        });
      }

      // Local fallback
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const url = `${baseUrl}/uploads/${req.file.filename}`;
      res.status(201).json({
        message: 'Image uploaded',
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url
      });
    } catch (error) {
      logger.error('Upload image error:', error);
      res.status(500).json({ error: 'Failed to upload image' });
    }
  }

  // ─── Bulk Upload ───
  async uploadMultiple(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No image files provided' });
      }

      if (config.s3.enabled) {
        const images = [];
        for (const file of req.files) {
          const result = await s3Service.uploadToS3(
            file.buffer,
            file.originalname,
            file.mimetype
          );
          images.push({
            filename: result.filename,
            key: result.key,
            originalName: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            url: result.url
          });
        }
        return res.status(201).json({ message: `${images.length} image(s) uploaded to S3`, images });
      }

      // Local fallback
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const images = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        url: `${baseUrl}/uploads/${file.filename}`
      }));

      res.status(201).json({ message: `${images.length} image(s) uploaded`, images });
    } catch (error) {
      logger.error('Upload multiple images error:', error);
      res.status(500).json({ error: 'Failed to upload images' });
    }
  }

  // ─── List Images ───
  async listImages(req, res) {
    try {
      if (config.s3.enabled) {
        const images = await s3Service.listFromS3();
        return res.json({ images, count: images.length });
      }

      // Local fallback
      const files = fs.readdirSync(UPLOAD_DIR);
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const images = files
        .filter(f => ALLOWED_EXT.includes(path.extname(f).toLowerCase()))
        .map(f => {
          const stats = fs.statSync(path.join(UPLOAD_DIR, f));
          return {
            filename: f,
            size: stats.size,
            uploadedAt: stats.mtime.toISOString(),
            url: `${baseUrl}/uploads/${f}`
          };
        })
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

      res.json({ images, count: images.length });
    } catch (error) {
      logger.error('List images error:', error);
      res.status(500).json({ error: 'Failed to list images' });
    }
  }

  // ─── Delete Image ───
  async deleteImage(req, res) {
    try {
      const { filename } = req.params;
      const sanitized = path.basename(filename);

      if (config.s3.enabled) {
        const key = `${config.s3.prefix}${sanitized}`;
        await s3Service.deleteFromS3(key);
        return res.json({ message: 'Image deleted from S3', filename: sanitized });
      }

      // Local fallback
      const filePath = path.join(UPLOAD_DIR, sanitized);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Image not found' });
      }

      fs.unlinkSync(filePath);
      res.json({ message: 'Image deleted', filename: sanitized });
    } catch (error) {
      logger.error('Delete image error:', error);
      res.status(500).json({ error: 'Failed to delete image' });
    }
  }
}

module.exports = new ImageController();
