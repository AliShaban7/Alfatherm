const express = require('express');
const router = express.Router();
const { salespersonController } = require('../controllers');
const { protect, ownerOnly } = require('../middleware/auth');

router.use(protect);

// Self-service / tag stats (before /:id so the literal paths match first).
router.get('/me/summary', salespersonController.getMySummary);
router.get('/me/customers', salespersonController.getMyCustomers);
router.get('/stats', salespersonController.getTagStats);

// Everyone (incl. employees) can read the list and a tag's debtors...
router.get('/', salespersonController.getAll);
router.get('/:id/debtors', salespersonController.getTagDebtors);
router.get('/:id', salespersonController.getById);

// ...but only owners / the super owner manage it.
router.post('/', ownerOnly, salespersonController.create);
router.put('/:id', ownerOnly, salespersonController.update);
router.delete('/:id', ownerOnly, salespersonController.delete);

module.exports = router;
