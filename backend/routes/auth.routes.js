const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const { protect, superOwnerOnly } = require('../middleware/auth');
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

// Public: login-page username autocomplete (prefix search, min 2 chars).
router.get('/usernames', authController.getUsernames);

router.get('/profile', protect, authController.getProfile);

router.put(
  '/change-password',
  protect,
  authValidator.changePasswordValidation,
  validateRequest,
  authController.changePassword
);

// User management — super-owner only
router.get('/users', protect, superOwnerOnly, authController.getUsers);
router.put('/users/:id', protect, superOwnerOnly, authController.updateUser);
router.post('/users/:id/reset-password', protect, superOwnerOnly, authController.resetPassword);
router.delete('/users/:id', protect, superOwnerOnly, authController.deleteUser);

module.exports = router;
