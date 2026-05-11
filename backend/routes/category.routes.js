const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { protect, ownerOnly } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const categoryValidator = require('../validators/category.validator');

// All routes require authentication
router.use(protect);

router.get('/', categoryController.getAll);

router.post(
  '/',
  ownerOnly,
  categoryValidator.createCategoryValidation,
  validateRequest,
  categoryController.create
);

router.put(
  '/:id',
  ownerOnly,
  categoryValidator.updateCategoryValidation,
  validateRequest,
  categoryController.update
);

router.delete(
  '/:id',
  ownerOnly,
  categoryValidator.deleteCategoryValidation,
  validateRequest,
  categoryController.delete
);

module.exports = router;
