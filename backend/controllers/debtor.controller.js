const debtorService = require('../services/debtor.service');

exports.getAll = async (req, res, next) => {
  try {
    const result = await debtorService.getAll(req.ownerId, req.query);
    
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
    const debtor = await debtorService.getById(req.params.id, req.ownerId);
    
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
    const debtor = await debtorService.addPayment(req.params.id, req.body, req.ownerId, req.user._id);
    
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
    const summary = await debtorService.getSummary(req.ownerId, req.query.branchId);
    
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
    const overdue = await debtorService.getOverdue(req.ownerId);
    
    res.status(200).json({
      success: true,
      data: overdue
    });
  } catch (error) {
    next(error);
  }
};
