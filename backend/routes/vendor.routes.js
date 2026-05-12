const express = require('express');
const router = express.Router();
const { vendorController } = require('../controllers');
const { protect, ownerOnly, ownerDataIsolation, employeeRestricted } = require('../middleware/auth');

router.use(protect);
router.use(ownerDataIsolation);
router.use(employeeRestricted); // Block employees from accessing vendors

router.post('/', ownerOnly, vendorController.create);

router.get('/', vendorController.getAll);

router.get('/:id', vendorController.getById);

router.put('/:id', ownerOnly, vendorController.update);

router.delete('/:id', ownerOnly, vendorController.delete);

module.exports = router;
