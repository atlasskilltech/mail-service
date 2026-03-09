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
      res.status(201).json({
        message: 'Image uploaded',
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: `${baseUrl}/uploads/${req.file.filename}`
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

  async listImages(req, res) {
    try {
      const files = await fs.promises.readdir(UPLOAD_DIR);
      const baseUrl = `${req.protocol}://${req.get('host')}`;

      const imageFiles = files.filter(f => ALLOWED_EXT.includes(path.extname(f).toLowerCase()));
      const images = await Promise.all(
        imageFiles.map(async f => {
          const stats = await fs.promises.stat(path.join(UPLOAD_DIR, f));
          return {
            filename: f,
            size: stats.size,
            uploadedAt: stats.mtime.toISOString(),
            url: `${baseUrl}/uploads/${f}`
          };
        })
      );

      images.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      res.json({ images, count: images.length });
    } catch (error) {
      logger.error('List images error:', error);
      res.status(500).json({ error: 'Failed to list images' });
    }
  }

  async deleteImage(req, res) {
    try {
      const { filename } = req.params;
      const sanitized = path.basename(filename);
      const filePath = path.join(UPLOAD_DIR, sanitized);

      try {
        await fs.promises.unlink(filePath);
        res.json({ message: 'Image deleted', filename: sanitized });
      } catch (err) {
        if (err.code === 'ENOENT') {
          return res.status(404).json({ error: 'Image not found' });
        }
        throw err;
      }
    } catch (error) {
      logger.error('Delete image error:', error);
      res.status(500).json({ error: 'Failed to delete image' });
    }
  }
}

module.exports = new ImageController();
