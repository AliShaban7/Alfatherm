const saleService = require('../services/sale.service');

exports.create = async (req, res, next) => {
  try {
    const sale = await saleService.create(req.body, req.user);
    
    res.status(201).json({
      success: true,
      data: sale
    });
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const result = await saleService.getAll(req.ownerId, req.query, req.canSeeCostPrice);
    
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
    const sale = await saleService.getById(req.params.id, req.ownerId, req.canSeeCostPrice);
    
    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (error) {
    next(error);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const sale = await saleService.cancel(req.params.id, req.ownerId, req.user._id);
    
    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (error) {
    next(error);
  }
};

exports.getDailySummary = async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const summary = await saleService.getDailySummary(req.ownerId, req.query.branchId, date);
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};
