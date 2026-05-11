const express = require('express');
const router = express.Router();
const { saleController } = require('../controllers');
const { protect, ownerOnly, canSeeCostPrice, ownerDataIsolation } = require('../middleware/auth');
const { saleValidator } = require('../validators');
const validateRequest = require('../middleware/validateRequest');

router.use(protect);
router.use(ownerDataIsolation);
router.use(canSeeCostPrice);

router.post(
  '/',
  saleValidator.createSaleValidation,
  validateRequest,
  saleController.create
);

router.get('/', saleController.getAll);

router.get('/daily-summary', saleController.getDailySummary);

router.get('/:id', saleController.getById);

router.put('/:id/cancel', ownerOnly, saleController.cancel);

module.exports = router;
