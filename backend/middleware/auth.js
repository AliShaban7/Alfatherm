const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ROLES, OWNER_IDS } = require('../config/constants');

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

    // An accountant has no books of their own — they work on a selected founder's
    // (or the store's) data. The acting owner comes from the x-acting-owner header
    // set by the UI's owner switcher; validate it against the known owners and
    // default to Zaur. Downstream scoping (ownerDataIsolation, report/sale slicing)
    // reads req.ownerId / req.user.ownerId, so set both.
    if (req.user.role === ROLES.ACCOUNTANT) {
      const allowed = Object.values(OWNER_IDS);
      const acting = req.headers['x-acting-owner'];
      const ownerId = allowed.includes(acting) ? acting : OWNER_IDS.ZAUR;
      req.ownerId = ownerId;
      req.user.ownerId = ownerId;
    }

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
  // Admin and salespeople work across all owner accounts; founders see only their own
  if (req.user.role === ROLES.SUPER_OWNER || req.user.role === ROLES.EMPLOYEE) {
    req.ownerFilter = {};
  } else {
    req.ownerFilter = { ownerId: req.ownerId };
  }
  next();
};

// Sales can mix products from several owners, so a founder must match any sale
// that contains their goods (ownerIds is a multikey array), not just sales whose
// primary ownerId is theirs. Use this on sale list/detail routes.
exports.ownerSaleIsolation = (req, res, next) => {
  if (req.user.role === ROLES.SUPER_OWNER || req.user.role === ROLES.EMPLOYEE) {
    req.ownerFilter = {};
  } else {
    req.ownerFilter = { ownerIds: req.ownerId };
  }
  next();
};

exports.canSeeCostPrice = (req, res, next) => {
  req.canSeeCostPrice =
    req.user.role === ROLES.OWNER ||
    req.user.role === ROLES.SUPER_OWNER ||
    req.user.role === ROLES.ACCOUNTANT;
  next();
};

// Owner-level finance endpoints the accountant also needs (P&L, branch report,
// recording creditors/fakturalar). Allows owners, the director, and accountants.
exports.ownerOrAccountant = (req, res, next) => {
  const ok =
    req.user.role === ROLES.OWNER ||
    req.user.role === ROLES.SUPER_OWNER ||
    req.user.role === ROLES.ACCOUNTANT;
  if (!ok) {
    return res.status(403).json({
      success: false,
      message: 'Bu əməliyyat üçün icazəniz yoxdur'
    });
  }
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
