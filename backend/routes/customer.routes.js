const express = require('express');
const router = express.Router();
const { customerController } = require('../controllers');
const { protect, ownerDataIsolation, employeeRestricted } = require('../middleware/auth');
const { customerValidator } = require('../validators');
const validateRequest = require('../middleware/validateRequest');

router.use(protect);
router.use(ownerDataIsolation);

router.post(
  '/',
  customerValidator.createCustomerValidation,
  validateRequest,
  customerController.create
);

router.get('/', customerController.getAll);

router.get('/:id', customerController.getById);

router.get('/:id/history', customerController.getHistory);

// Editing/deleting the shared customer master is an owner/director action. A
// salesperson (EMPLOYEE) can create and read customers at checkout, but must
// not be able to alter or remove existing records.
router.put(
  '/:id',
  employeeRestricted,
  customerValidator.updateCustomerValidation,
  validateRequest,
  customerController.update
);

router.delete('/:id', employeeRestricted, customerController.delete);

module.exports = router;
