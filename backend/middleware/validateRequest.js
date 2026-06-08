const { validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg
    }));

    return res.status(400).json({
      success: false,
      message: extractedErrors[0]?.message || 'Doğrulama xətası',
      errors: extractedErrors
    });
  }
  
  next();
};

module.exports = validateRequest;
