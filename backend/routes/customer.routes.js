const express = require('express');
const router = express.Router();
const { customerController } = require('../controllers');
const { protect, ownerDataIsolation } = require('../middleware/auth');
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

router.put(
  '/:id',
  customerValidator.updateCustomerValidation,
  validateRequest,
  customerController.update
);

router.delete('/:id', customerController.delete);

module.exports = router;
