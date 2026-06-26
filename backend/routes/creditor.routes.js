const express = require('express');
const router = express.Router();
const { creditorController } = require('../controllers');
const { protect, ownerOrAccountant, ownerDataIsolation, employeeRestricted } = require('../middleware/auth');

router.use(protect);
router.use(ownerDataIsolation);
router.use(employeeRestricted); // Block employees from accessing creditors

router.post('/', ownerOrAccountant, creditorController.create);

router.get('/', creditorController.getAll);

router.get('/summary', creditorController.getSummary);

router.get('/:id', creditorController.getById);

router.post('/:id/payment', creditorController.addPayment);

module.exports = router;
