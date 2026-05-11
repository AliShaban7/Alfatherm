const express = require('express');
const router = express.Router();
const { inventoryController } = require('../controllers');
const { protect, ownerOnly, canSeeCostPrice, canAccessMainWarehouse, ownerDataIsolation } = require('../middleware/auth');
const { inventoryValidator } = require('../validators');
const validateRequest = require('../middleware/validateRequest');

router.use(protect);
router.use(ownerDataIsolation);
router.use(canSeeCostPrice);
router.use(canAccessMainWarehouse);

router.post(
  '/entry',
  ownerOnly,
  inventoryValidator.productEntryValidation,
  validateRequest,
  inventoryController.productEntry
);

router.post(
  '/transfer',
  inventoryValidator.transferValidation,
  validateRequest,
  inventoryController.transfer
);

router.get('/', inventoryController.getAll);

router.get('/transactions', inventoryController.getTransactions);

router.get('/warehouse/:warehouseId', inventoryController.getByWarehouse);

router.put(
  '/:id',
  ownerOnly,
  inventoryController.update
);

router.delete(
  '/:id',
  ownerOnly,
  inventoryController.delete
);

module.exports = router;
