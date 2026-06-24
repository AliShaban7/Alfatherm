const express = require('express');
const router = express.Router();
const { inventoryController } = require('../controllers');
const { protect, canSeeCostPrice, canAccessMainWarehouse, ownerDataIsolation, employeeRestricted } = require('../middleware/auth');
const { inventoryValidator } = require('../validators');
const validateRequest = require('../middleware/validateRequest');

router.use(protect);
router.use(ownerDataIsolation);
router.use(canSeeCostPrice);
router.use(canAccessMainWarehouse);

// Salespeople stock the store with goods they bought locally: add stock and bulk
// import. Both are scoped by ownerId, so a salesperson can only ever touch their
// own (store) namespace — never an owner's catalogue/stock.
router.post('/import-stock', inventoryController.importStock);
router.post(
  '/entry',
  inventoryValidator.productEntryValidation,
  validateRequest,
  inventoryController.productEntry
);
// Transfers between warehouses are owner-only.
router.post(
  '/transfer',
  employeeRestricted,
  inventoryValidator.transferValidation,
  validateRequest,
  inventoryController.transfer
);
// Bulk transfer: many products, one source/destination, one transaction.
router.post('/transfer-bulk', employeeRestricted, inventoryController.transferBulk);

router.get('/', inventoryController.getAll);
router.get('/transactions', employeeRestricted, inventoryController.getTransactions);
router.get('/warehouse/:warehouseId', inventoryController.getByWarehouse);

// Adjusting or removing an existing stock record stays owner-only.
router.put('/:id', employeeRestricted, inventoryController.update);
router.delete('/:id', employeeRestricted, inventoryController.delete);

module.exports = router;
