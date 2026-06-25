const express = require('express');
const router = express.Router();
const { vendorController } = require('../controllers');
const { protect, ownerOnly, ownerDataIsolation } = require('../middleware/auth');

router.use(protect);
router.use(ownerDataIsolation);

// Sales accounts (salespeople) can view, add and edit vendors (İstehsalçı) — they
// manage their store's local suppliers and assign them to products. Deleting a
// vendor stays owner-only to avoid orphaning products that reference it.
router.post('/', vendorController.create);

router.get('/', vendorController.getAll);

router.get('/:id', vendorController.getById);

router.put('/:id', vendorController.update);

router.delete('/:id', ownerOnly, vendorController.delete);

module.exports = router;
