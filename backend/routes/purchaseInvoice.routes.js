const express = require('express');
const router = express.Router();
const { purchaseInvoiceController } = require('../controllers');
const { body } = require('express-validator');
const {
  protect, ownerOnly, ownerDataIsolation, employeeRestricted,
  canAccessMainWarehouse
} = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

router.use(protect);
router.use(employeeRestricted); // purchases are owner/director only
router.use(ownerDataIsolation);
router.use(canAccessMainWarehouse);

const createValidation = [
  body('vendorId').notEmpty().withMessage('Vendor seçin').isMongoId(),
  body('warehouseId').notEmpty().withMessage('Anbar seçin').isMongoId(),
  body('items').isArray({ min: 1 }).withMessage('Ən azı bir məhsul əlavə edin'),
  body('items.*.productId').notEmpty().withMessage('Məhsul seçin').isMongoId(),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Miqdar minimum 1 olmalıdır'),
  body('items.*.costPrice').isFloat({ min: 0 }).withMessage('Maya dəyəri mənfi ola bilməz'),
  body('paymentStatus').isIn(['paid', 'partial', 'unpaid']).withMessage('Düzgün ödəniş statusu seçin'),
  body('paidAmount').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('dueDate').optional({ values: 'falsy' }).isISO8601(),
  body('vendorInvoiceNumber').optional().trim(),
  body('note').optional().trim()
];

router.post('/', ownerOnly, createValidation, validateRequest, purchaseInvoiceController.create);
router.get('/', purchaseInvoiceController.getAll);
router.get('/:id', purchaseInvoiceController.getById);

module.exports = router;
