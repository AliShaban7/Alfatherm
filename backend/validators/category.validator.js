const { body, param } = require('express-validator');

exports.createCategoryValidation = [
  body('name')
    .notEmpty().withMessage('Kateqoriya adı daxil edin')
    .trim(),
  
  body('code')
    .notEmpty().withMessage('Kateqoriya kodu daxil edin')
    .trim()
    .toLowerCase()
    .matches(/^[a-z0-9_-]+$/).withMessage('Kod yalnız kiçik hərflər, rəqəmlər, tire və alt xətt istifadə edə bilər'),
  
  body('type')
    .optional()
    .isIn(['product', 'expense']).withMessage('Tip product və ya expense olmalıdır')
];

exports.updateCategoryValidation = [
  param('id')
    .isMongoId().withMessage('Düzgün kateqoriya ID daxil edin'),
  
  body('name')
    .optional()
    .notEmpty().withMessage('Kateqoriya adı boş ola bilməz')
    .trim(),
  
  body('code')
    .optional()
    .notEmpty().withMessage('Kateqoriya kodu boş ola bilməz')
    .trim()
    .toLowerCase()
    .matches(/^[a-z0-9_-]+$/).withMessage('Kod yalnız kiçik hərflər, rəqəmlər, tire və alt xətt istifadə edə bilər')
];

exports.deleteCategoryValidation = [
  param('id')
    .isMongoId().withMessage('Düzgün kateqoriya ID daxil edin')
];
