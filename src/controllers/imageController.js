const fs = require('fs');
const path = require('path');
const { UPLOAD_DIR } = require('../middleware/upload');
const logger = require('../utils/logger');

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

class ImageController {
  async uploadImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

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

  async uploadMultiple(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No image files provided' });
      }

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

  async listImages(_req, res) {
    try {
      const files = fs.readdirSync(UPLOAD_DIR);
      const images = files
        .filter(f => ALLOWED_EXT.includes(path.extname(f).toLowerCase()))
        .map(f => {
          const stats = fs.statSync(path.join(UPLOAD_DIR, f));
          return {
            filename: f,
            size: stats.size,
            uploadedAt: stats.mtime.toISOString(),
            url: `/uploads/${f}`
          };
        })
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

      res.json({ images, count: images.length });
    } catch (error) {
      logger.error('List images error:', error);
      res.status(500).json({ error: 'Failed to list images' });
    }
  }

  async deleteImage(req, res) {
    try {
      const { filename } = req.params;

      // Sanitize filename to prevent path traversal
      const sanitized = path.basename(filename);
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
