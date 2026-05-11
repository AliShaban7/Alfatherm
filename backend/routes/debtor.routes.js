const express = require('express');
const router = express.Router();
const { debtorController } = require('../controllers');
const { protect, ownerDataIsolation } = require('../middleware/auth');

router.use(protect);
router.use(ownerDataIsolation);

router.get('/', debtorController.getAll);

router.get('/summary', debtorController.getSummary);

router.get('/overdue', debtorController.getOverdue);

router.get('/:id', debtorController.getById);

router.post('/:id/payment', debtorController.addPayment);

module.exports = router;
