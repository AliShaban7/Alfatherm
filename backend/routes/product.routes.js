const express = require('express');
const router = express.Router();
const { productController } = require('../controllers');
const { protect, ownerOnly, canSeeCostPrice, ownerDataIsolation } = require('../middleware/auth');
const { productValidator } = require('../validators');
const validateRequest = require('../middleware/validateRequest');

router.use(protect);
router.use(ownerDataIsolation);
router.use(canSeeCostPrice);

router.post(
  '/',
  ownerOnly,
  productValidator.createProductValidation,
  validateRequest,
  productController.create
);

router.get('/', productController.getAll);

router.get('/:id', productController.getById);

router.get('/:id/stock', productController.getWithStock);

router.put(
  '/:id',
  ownerOnly,
  productValidator.updateProductValidation,
  validateRequest,
  productController.update
);

router.delete('/:id', ownerOnly, productController.delete);

module.exports = router;
