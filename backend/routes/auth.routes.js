const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const { protect } = require('../middleware/auth');
const { authValidator } = require('../validators');
const validateRequest = require('../middleware/validateRequest');

router.post(
  '/register',
  authValidator.registerValidation,
  validateRequest,
  authController.register
);

router.post(
  '/login',
  authValidator.loginValidation,
  validateRequest,
  authController.login
);

router.get('/profile', protect, authController.getProfile);

router.put(
  '/change-password',
  protect,
  authValidator.changePasswordValidation,
  validateRequest,
  authController.changePassword
);

module.exports = router;
