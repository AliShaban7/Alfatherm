const { body, param } = require('express-validator');
const { PRODUCT_CATEGORIES, PRODUCT_UNITS } = require('../config/constants');

exports.createProductValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Məhsul adı daxil edin'),
  
  body('sku')
    .optional()
    .trim()
    .toUpperCase(),
  
  body('category')
    .notEmpty().withMessage('Kateqoriya seçin')
    .trim(),
  
  body('unit')
    .optional()
    .isIn(Object.values(PRODUCT_UNITS)).withMessage('Düzgün vahid seçin'),
  
  body('costPrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Maya dəyəri mənfi ola bilməz'),
  
  // Selling prices are optional at creation (set later at Mal Girişi / stock);
  // they default to 0 on the model.
  body('minPrice')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Minimum qiymət mənfi ola bilməz'),

  body('recommendedPrice')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Tövsiyə olunan qiymət mənfi ola bilməz')
    .custom((value, { req }) => {
      if (req.body.minPrice && parseFloat(value) < parseFloat(req.body.minPrice)) {
        throw new Error('Tövsiyə olunan qiymət minimum qiymətdən az ola bilməz');
      }
      return true;
    }),

  body('brand').optional().trim(),
  // vendorId is part of the (owner, name, vendor) uniqueness key, so it reaches a
  // query filter — an uncastable value would surface as a misleading 404.
  // checkFalsy so '' / null ("no vendor") are skipped rather than rejected.
  body('vendorId')
    .optional({ checkFalsy: true })
    .isMongoId().withMessage('Düzgün İstehsalçı seçin'),
  body('manufacturer').optional().trim(),
  body('country').optional().trim(),
  body('color').optional().trim(),
  body('description').optional().trim(),
  body('barcode').optional().trim()
];

exports.updateProductValidation = [
  param('id').isMongoId().withMessage('Düzgün məhsul ID daxil edin'),
  
  body('name').optional().trim().notEmpty().withMessage('Məhsul adı boş ola bilməz'),

  // See createProductValidation: part of the uniqueness key, so it must be a
  // valid id when present; '' / null mean "no İstehsalçı" and are allowed.
  body('vendorId')
    .optional({ checkFalsy: true })
    .isMongoId().withMessage('Düzgün İstehsalçı seçin'),

  body('category')
    .optional()
    .trim(),
  
  body('unit')
    .optional()
    .isIn(Object.values(PRODUCT_UNITS)).withMessage('Düzgün vahid seçin'),
  
  body('costPrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Maya dəyəri mənfi ola bilməz'),
  
  body('minPrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Minimum qiymət mənfi ola bilməz'),
  
  body('recommendedPrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Tövsiyə olunan qiymət mənfi ola bilməz')
];
