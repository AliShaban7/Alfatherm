const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const { protect, superOwnerOnly } = require('../middleware/auth');
const { authValidator } = require('../validators');
const validateRequest = require('../middleware/validateRequest');

// Creating users (founders/employees) is a director-only operation. Without the
// guard, anyone could self-register as SUPER_OWNER for any owner and take over
// the whole system. Only Anar (SUPER_OWNER) may provision accounts.
router.post(
  '/register',
  protect,
  superOwnerOnly,
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
