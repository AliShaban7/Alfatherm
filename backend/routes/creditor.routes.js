const express = require('express');
const router = express.Router();
const { creditorController } = require('../controllers');
const { protect, ownerOnly, ownerDataIsolation } = require('../middleware/auth');

router.use(protect);
router.use(ownerDataIsolation);

router.post('/', ownerOnly, creditorController.create);

router.get('/', creditorController.getAll);

router.get('/summary', creditorController.getSummary);

router.get('/:id', creditorController.getById);

router.post('/:id/payment', creditorController.addPayment);

module.exports = router;
