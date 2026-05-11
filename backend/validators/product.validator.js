const { body, param } = require('express-validator');
const { PRODUCT_CATEGORIES, PRODUCT_UNITS } = require('../config/constants');

exports.createProductValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Məhsul adı daxil edin'),
  
  body('sku')
    .trim()
    .notEmpty().withMessage('SKU daxil edin')
    .toUpperCase(),
  
  body('category')
    .notEmpty().withMessage('Kateqoriya seçin')
    .isIn(Object.values(PRODUCT_CATEGORIES)).withMessage('Düzgün kateqoriya seçin'),
  
  body('unit')
    .optional()
    .isIn(Object.values(PRODUCT_UNITS)).withMessage('Düzgün vahid seçin'),
  
  body('costPrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Maya dəyəri mənfi ola bilməz'),
  
  body('minPrice')
    .notEmpty().withMessage('Minimum qiymət daxil edin')
    .isFloat({ min: 0 }).withMessage('Minimum qiymət mənfi ola bilməz'),
  
  body('recommendedPrice')
    .notEmpty().withMessage('Tövsiyə olunan qiymət daxil edin')
    .isFloat({ min: 0 }).withMessage('Tövsiyə olunan qiymət mənfi ola bilməz')
    .custom((value, { req }) => {
      if (parseFloat(value) < parseFloat(req.body.minPrice)) {
        throw new Error('Tövsiyə olunan qiymət minimum qiymətdən az ola bilməz');
      }
      return true;
    }),

  body('brand').optional().trim(),
  body('manufacturer').optional().trim(),
  body('country').optional().trim(),
  body('color').optional().trim(),
  body('description').optional().trim(),
  body('barcode').optional().trim()
];

exports.updateProductValidation = [
  param('id').isMongoId().withMessage('Düzgün məhsul ID daxil edin'),
  
  body('name').optional().trim().notEmpty().withMessage('Məhsul adı boş ola bilməz'),
  
  body('category')
    .optional()
    .isIn(Object.values(PRODUCT_CATEGORIES)).withMessage('Düzgün kateqoriya seçin'),
  
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
