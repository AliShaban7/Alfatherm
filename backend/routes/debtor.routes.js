const express = require('express');
const router = express.Router();
const { debtorController } = require('../controllers');
const { protect, ownerDataIsolation, employeeRestricted } = require('../middleware/auth');

router.use(protect);
router.use(ownerDataIsolation);
router.use(employeeRestricted); // Block employees from accessing debtors

router.get('/', debtorController.getAll);

router.get('/summary', debtorController.getSummary);

router.get('/overdue', debtorController.getOverdue);

router.get('/:id', debtorController.getById);

router.post('/:id/payment', debtorController.addPayment);

module.exports = router;
