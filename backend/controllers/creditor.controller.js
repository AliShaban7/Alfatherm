const creditorService = require('../services/creditor.service');

exports.create = async (req, res, next) => {
  try {
    const creditor = await creditorService.create(req.body, req.ownerId, req.user._id);
    
    res.status(201).json({
      success: true,
      data: creditor
    });
  } catch (error) {
    next(error);
  }
};

// req.ownerFilter (from ownerDataIsolation): {} for the director (sees all
// owners' creditors), { ownerId } for an owner (only their own).
exports.getAll = async (req, res, next) => {
  try {
    const result = await creditorService.getAll(req.ownerFilter, req.query);

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
    const creditor = await creditorService.getById(req.params.id, req.ownerFilter);

    res.status(200).json({
      success: true,
      data: creditor
    });
  } catch (error) {
    next(error);
  }
};

exports.addPayment = async (req, res, next) => {
  try {
    const creditor = await creditorService.addPayment(req.params.id, req.body, req.ownerFilter, req.user._id);

    res.status(200).json({
      success: true,
      data: creditor
    });
  } catch (error) {
    next(error);
  }
};

exports.getSummary = async (req, res, next) => {
  try {
    const summary = await creditorService.getSummary(req.ownerFilter);

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};
