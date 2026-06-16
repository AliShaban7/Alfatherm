const express = require('express');
const router = express.Router();
const { salespersonController } = require('../controllers');
const { protect, ownerOnly } = require('../middleware/auth');

router.use(protect);

// Everyone (incl. employees on the New Sale screen) can read the list...
router.get('/', salespersonController.getAll);
router.get('/:id', salespersonController.getById);

// ...but only owners / the super owner manage it.
router.post('/', ownerOnly, salespersonController.create);
router.put('/:id', ownerOnly, salespersonController.update);
router.delete('/:id', ownerOnly, salespersonController.delete);

module.exports = router;
