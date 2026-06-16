const express = require('express');
const router = express.Router();
const { ustaController } = require('../controllers');
const { protect, ownerOnly } = require('../middleware/auth');

router.use(protect);

// Everyone (incl. employees on the New Sale screen) can read the list...
router.get('/', ustaController.getAll);
router.get('/balances', ownerOnly, ustaController.getBalances);
router.get('/:id', ustaController.getById);

// ...but only owners / the super owner manage ustas and settle balances.
router.post('/', ownerOnly, ustaController.create);
router.post('/:id/pay', ownerOnly, ustaController.pay);
router.put('/:id', ownerOnly, ustaController.update);
router.delete('/:id', ownerOnly, ustaController.delete);

module.exports = router;
