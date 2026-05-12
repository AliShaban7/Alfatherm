const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Bu əməliyyat üçün giriş tələb olunur'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'İstifadəçi tapılmadı'
      });
    }

    if (!req.user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Hesabınız deaktiv edilib'
      });
    }

    req.ownerId = decoded.ownerId;
    req.userRole = decoded.role;
    req.branchId = decoded.branchId;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Token etibarsızdır'
    });
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Bu əməliyyat üçün icazəniz yoxdur'
      });
    }
    next();
  };
};

exports.ownerOnly = (req, res, next) => {
  if (req.user.role !== ROLES.OWNER && req.user.role !== ROLES.SUPER_OWNER) {
    return res.status(403).json({
      success: false,
      message: 'Bu əməliyyat yalnız sahiblər üçün icazəlidir'
    });
  }
  next();
};

exports.superOwnerOnly = (req, res, next) => {
  if (req.user.role !== ROLES.SUPER_OWNER) {
    return res.status(403).json({
      success: false,
      message: 'Bu əməliyyat yalnız baş sahiblər üçün icazəlidir'
    });
  }
  next();
};

exports.ownerDataIsolation = (req, res, next) => {
  req.ownerFilter = { ownerId: req.ownerId };
  next();
};

exports.canSeeCostPrice = (req, res, next) => {
  req.canSeeCostPrice = req.user.role === ROLES.OWNER || req.user.role === ROLES.SUPER_OWNER;
  next();
};

exports.canAccessMainWarehouse = (req, res, next) => {
  req.canAccessMainWarehouse = req.user.role === ROLES.OWNER || req.user.role === ROLES.SUPER_OWNER;
  next();
};

// Middleware to restrict employees (salespeople) from accessing owner-only features
exports.employeeRestricted = (req, res, next) => {
  if (req.user.role === ROLES.EMPLOYEE) {
    return res.status(403).json({
      success: false,
      message: 'Bu bölməyə giriş icazəniz yoxdur'
    });
  }
  next();
};
