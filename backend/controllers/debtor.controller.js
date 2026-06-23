const debtorService = require('../services/debtor.service');

// req.ownerFilter (from ownerDataIsolation): {} for the director (sees all
// owners' debtors), { ownerId } for an owner (only their own).
exports.getAll = async (req, res, next) => {
  try {
    const result = await debtorService.getAll(req.ownerFilter, req.query);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const debtor = await debtorService.getById(req.params.id, req.ownerFilter);

    res.status(200).json({
      success: true,
      data: debtor
    });
  } catch (error) {
    next(error);
  }
};

exports.addPayment = async (req, res, next) => {
  try {
    const debtor = await debtorService.addPayment(req.params.id, req.body, req.ownerFilter, req.user._id);

    res.status(200).json({
      success: true,
      data: debtor
    });
  } catch (error) {
    next(error);
  }
};

exports.getSummary = async (req, res, next) => {
  try {
    const summary = await debtorService.getSummary(req.ownerFilter, req.query.branchId);

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

exports.getOverdue = async (req, res, next) => {
  try {
    const overdue = await debtorService.getOverdue(req.ownerFilter);

    res.status(200).json({
      success: true,
      data: overdue
    });
  } catch (error) {
    next(error);
  }
};
