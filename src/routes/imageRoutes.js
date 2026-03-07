const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// Upload single image
router.post('/', authenticate, upload.single('image'), (req, res) => imageController.uploadImage(req, res));

// Upload multiple images (max 10)
router.post('/bulk', authenticate, upload.array('images', 10), (req, res) => imageController.uploadMultiple(req, res));

// List all uploaded images
router.get('/', authenticate, (req, res) => imageController.listImages(req, res));

// Delete an image
router.delete('/:filename', authenticate, (req, res) => imageController.deleteImage(req, res));

// Multer error handler
router.use((err, req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum size is 5MB' });
  }
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Upload failed' });
});

module.exports = router;
