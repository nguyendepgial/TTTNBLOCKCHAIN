const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middlewares/auth');
const {
  register,
  login,
  sendVerificationEmail,
  verifyEmail,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword
} = require('../../controllers/user/user.controller');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.post('/send-verification', verifyToken, sendVerificationEmail);
router.put('/profile', verifyToken, updateProfile);
router.put('/change-password', verifyToken, changePassword);

module.exports = router;