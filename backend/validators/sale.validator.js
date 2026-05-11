const { body, param } = require('express-validator');
const { PAYMENT_TYPES, PAYMENT_METHODS } = require('../config/constants');

exports.createSaleValidation = [
  body('customerId')
    .notEmpty().withMessage('Müştəri seçin')
    .isMongoId().withMessage('Düzgün müştəri ID daxil edin'),
  
  body('warehouseId')
    .notEmpty().withMessage('Anbar seçin')
    .isMongoId().withMessage('Düzgün anbar ID daxil edin'),
  
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
    .optional()
    .isIn(Object.values(PAYMENT_METHODS)).withMessage('Düzgün ödəniş metodu seçin'),
  
  body('isOfficial')
    .optional()
    .isBoolean().withMessage('Düzgün dəyər daxil edin'),
  
  body('paidAmount')
    .optional()
    .isFloat({ min: 0 }).withMessage('Ödənilən məbləğ mənfi ola bilməz'),
  
  body('note').optional().trim()
];

exports.getSaleValidation = [
  param('id').isMongoId().withMessage('Düzgün satış ID daxil edin')
];
