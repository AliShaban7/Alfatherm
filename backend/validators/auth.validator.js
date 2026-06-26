const { body } = require('express-validator');
const { ROLES } = require('../config/constants');

exports.registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Ad daxil edin')
    .isLength({ max: 100 }).withMessage('Ad 100 simvoldan çox ola bilməz'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email daxil edin')
    .isEmail().withMessage('Düzgün email daxil edin')
    .normalizeEmail(),
  
  body('phone')
    .trim()
    .notEmpty().withMessage('Telefon nömrəsi daxil edin'),
  
  body('password')
    .notEmpty().withMessage('Şifrə daxil edin')
    .isLength({ min: 6 }).withMessage('Şifrə minimum 6 simvol olmalıdır'),
  
  body('role')
    .optional()
    .isIn(Object.values(ROLES)).withMessage('Düzgün rol seçin'),
  
  body('ownerId')
    .notEmpty().withMessage('Owner ID tələb olunur'),
  
  body('branchId')
    // Only EMPLOYEE accounts carry a branch; others (owner/director/accountant)
    // send an empty branchId, so treat falsy as absent instead of failing isMongoId.
    .optional({ checkFalsy: true })
    .isMongoId().withMessage('Düzgün filial ID daxil edin')
];

exports.loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email daxil edin')
    .isEmail().withMessage('Düzgün email daxil edin')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Şifrə daxil edin')
];

exports.changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Cari şifrəni daxil edin'),
  
  body('newPassword')
    .notEmpty().withMessage('Yeni şifrəni daxil edin')
    .isLength({ min: 6 }).withMessage('Yeni şifrə minimum 6 simvol olmalıdır')
];
