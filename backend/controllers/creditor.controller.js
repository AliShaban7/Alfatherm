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

exports.getAll = async (req, res, next) => {
  try {
    const result = await creditorService.getAll(req.ownerId, req.query);
    
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
    const creditor = await creditorService.getById(req.params.id, req.ownerId);
    
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
    const creditor = await creditorService.addPayment(req.params.id, req.body, req.ownerId, req.user._id);
    
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
    const summary = await creditorService.getSummary(req.ownerId);
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};
