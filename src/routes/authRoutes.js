const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Login with email only - restricted to allowed email
router.post('/login', (req, res) => authController.login(req, res));

module.exports = router;
