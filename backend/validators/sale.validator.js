const { body, param } = require('express-validator');
const { PAYMENT_TYPES, PAYMENT_METHODS } = require('../config/constants');

exports.createSaleValidation = [
  body('customerId')
    .notEmpty().withMessage('Müştəri seçin')
    .isMongoId().withMessage('Düzgün müştəri ID daxil edin'),
  
  body('warehouseId')
    .notEmpty().withMessage('Anbar seçin')
    .isMongoId().withMessage('Düzgün anbar ID daxil edin'),

  body('salespersonId')
    .notEmpty().withMessage('Satıcı seçin')
    .isMongoId().withMessage('Düzgün satıcı ID daxil edin'),

  body('items')
    .isArray({ min: 1 }).withMessage('Minimum 1 məhsul əlavə edin'),
  
  body('items.*.productId')
    .notEmpty().withMessage('Məhsul seçin')
    .isMongoId().withMessage('Düzgün məhsul ID daxil edin'),
  
  body('items.*.quantity')
    .notEmpty().withMessage('Miqdar daxil edin')
    .isInt({ min: 1 }).withMessage('Miqdar minimum 1 olmalıdır'),
  
  body('items.*.unitPrice')
    .notEmpty().withMessage('Qiymət daxil edin')
    .isFloat({ min: 0 }).withMessage('Qiymət mənfi ola bilməz'),
  
  body('paymentType')
    .notEmpty().withMessage('Ödəniş tipi seçin')
    .isIn(Object.values(PAYMENT_TYPES)).withMessage('Düzgün ödəniş tipi seçin'),
  
  body('paymentMethod')
    .optional({ values: 'falsy' })
    .isIn(Object.values(PAYMENT_METHODS)).withMessage('Düzgün ödəniş metodu seçin'),
  
  body('isOfficial')
    .optional()
    .isBoolean().withMessage('Düzgün dəyər daxil edin'),
  
  body('paidAmount')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0 }).withMessage('Ödənilən məbləğ mənfi ola bilməz'),

  // Referral commission (optional). If an amount is given, an usta is required.
  body('commission').optional().isObject().withMessage('Düzgün komissiya məlumatı daxil edin'),
  body('commission.amount')
    .optional({ values: 'falsy' })
    .isFloat({ gt: 0 }).withMessage('Komissiya məbləği müsbət olmalıdır'),
  body('commission.ustaId')
    .if((value, { req }) => Number(req.body?.commission?.amount) > 0)
    .notEmpty().withMessage('Usta seçin')
    .isMongoId().withMessage('Düzgün usta ID daxil edin'),

  // On-the-spot sale expenses (optional rows; each must be complete + non-zero).
  body('saleExpenses').optional().isArray().withMessage('Düzgün xərc siyahısı daxil edin'),
  // Category is free text now (searchable + addable): require a non-empty,
  // length-capped label instead of matching a fixed list.
  body('saleExpenses.*.category')
    .trim()
    .notEmpty().withMessage('Xərc kateqoriyası daxil edin')
    .isLength({ max: 60 }).withMessage('Kateqoriya 60 simvoldan çox ola bilməz'),
  body('saleExpenses.*.amount')
    .isFloat({ gt: 0 }).withMessage('Xərc məbləği müsbət olmalıdır'),

  body('note').optional().trim()
];

exports.getSaleValidation = [
  param('id').isMongoId().withMessage('Düzgün satış ID daxil edin')
];
