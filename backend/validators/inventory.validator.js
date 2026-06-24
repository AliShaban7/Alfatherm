const { body, param } = require('express-validator');

exports.productEntryValidation = [
  // Optional: paid (cash) local-store buys have no formal vendor. The service
  // still requires one for credit (borc) entries.
  body('vendorId')
    .optional({ checkFalsy: true })
    .isMongoId().withMessage('Düzgün vendor ID daxil edin'),
  
  body('productId')
    .notEmpty().withMessage('Məhsul seçin')
    .isMongoId().withMessage('Düzgün məhsul ID daxil edin'),
  
  body('warehouseId')
    .notEmpty().withMessage('Anbar seçin')
    .isMongoId().withMessage('Düzgün anbar ID daxil edin'),
  
  body('quantity')
    .notEmpty().withMessage('Miqdar daxil edin')
    .isInt({ min: 1 }).withMessage('Miqdar minimum 1 olmalıdır'),
  
  body('costPrice')
    .notEmpty().withMessage('Maya dəyəri daxil edin')
    .isFloat({ min: 0 }).withMessage('Maya dəyəri mənfi ola bilməz'),
  
  body('paymentStatus')
    .notEmpty().withMessage('Ödəniş statusu seçin')
    .isIn(['paid', 'partial', 'unpaid']).withMessage('Düzgün ödəniş statusu seçin'),
  
  body('paidAmount')
    .optional()
    .isFloat({ min: 0 }).withMessage('Ödənilmiş məbləğ mənfi ola bilməz'),
  
  body('dueDate')
    .optional()
    .isISO8601().withMessage('Düzgün tarix daxil edin'),
  
  body('note').optional().trim()
];

exports.transferValidation = [
  body('productId')
    .notEmpty().withMessage('Məhsul seçin')
    .isMongoId().withMessage('Düzgün məhsul ID daxil edin'),
  
  body('fromWarehouseId')
    .notEmpty().withMessage('Mənbə anbar seçin')
    .isMongoId().withMessage('Düzgün anbar ID daxil edin'),
  
  body('toWarehouseId')
    .notEmpty().withMessage('Hədəf anbar seçin')
    .isMongoId().withMessage('Düzgün anbar ID daxil edin')
    .custom((value, { req }) => {
      if (value === req.body.fromWarehouseId) {
        throw new Error('Mənbə və hədəf anbar eyni ola bilməz');
      }
      return true;
    }),
  
  body('quantity')
    .notEmpty().withMessage('Miqdar daxil edin')
    .isInt({ min: 1 }).withMessage('Miqdar minimum 1 olmalıdır'),
  
  body('note').optional().trim()
];

exports.getInventoryValidation = [
  param('warehouseId').optional().isMongoId().withMessage('Düzgün anbar ID daxil edin')
];
