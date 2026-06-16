const purchaseInvoiceService = require('../services/purchaseInvoice.service');
const { ROLES } = require('../config/constants');

exports.create = async (req, res, next) => {
  try {
    // Super owner can file an invoice under a specific owner; others use their own.
    const ownerId = req.user.role === ROLES.SUPER_OWNER && req.body.ownerId
      ? req.body.ownerId
      : req.ownerId;

    const invoice = await purchaseInvoiceService.create(
      req.body,
      ownerId,
      req.user._id,
      req.canAccessMainWarehouse
    );

    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const result = await purchaseInvoiceService.getAll(req.ownerFilter, req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const invoice = await purchaseInvoiceService.getById(req.params.id, req.ownerFilter);
    res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};
