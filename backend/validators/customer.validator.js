const { body, param } = require('express-validator');
const { CUSTOMER_TYPES } = require('../config/constants');

exports.createCustomerValidation = [
  body('type')
    .notEmpty().withMessage('Müştəri tipi seçin')
    .isIn(Object.values(CUSTOMER_TYPES)).withMessage('Düzgün müştəri tipi seçin'),
  
  body('name')
    .trim()
    .notEmpty().withMessage('Ad daxil edin'),
  
  body('phone')
    .trim()
    .notEmpty().withMessage('Telefon nömrəsi daxil edin'),
  
  body('voen')
    .optional()
    .trim()
    .custom((value, { req }) => {
      if (req.body.type === CUSTOMER_TYPES.LEGAL && !value) {
        throw new Error('Hüquqi şəxslər üçün VÖEN tələb olunur');
      }
      return true;
    }),
  
  body('fin').optional().trim(),
  body('brandName').optional().trim(),
  body('address').optional().trim(),
  body('contactPerson').optional().trim(),
  body('email').optional().trim().isEmail().withMessage('Düzgün email daxil edin'),
  body('note').optional().trim()
];

exports.updateCustomerValidation = [
  param('id').isMongoId().withMessage('Düzgün müştəri ID daxil edin'),
  
  body('type')
    .optional()
    .isIn(Object.values(CUSTOMER_TYPES)).withMessage('Düzgün müştəri tipi seçin'),
  
  body('name').optional().trim().notEmpty().withMessage('Ad boş ola bilməz'),
  body('phone').optional().trim().notEmpty().withMessage('Telefon boş ola bilməz'),
  body('email').optional().trim().isEmail().withMessage('Düzgün email daxil edin')
];
