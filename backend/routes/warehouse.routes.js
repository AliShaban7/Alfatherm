const express = require('express');
const router = express.Router();
const { warehouseController } = require('../controllers');
const { protect, ownerOnly, canAccessMainWarehouse } = require('../middleware/auth');

router.use(protect);
router.use(canAccessMainWarehouse);

router.post('/', ownerOnly, warehouseController.create);

router.get('/', warehouseController.getAll);

router.get('/main', ownerOnly, warehouseController.getMain);

router.get('/:id', warehouseController.getById);

router.put('/:id', ownerOnly, warehouseController.update);

router.delete('/:id', ownerOnly, warehouseController.delete);

module.exports = router;
