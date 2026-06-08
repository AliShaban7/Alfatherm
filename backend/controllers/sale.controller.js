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
    const result = await saleService.getAll(req.ownerFilter, req.query, req.canSeeCostPrice, req.user);
    
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
    const sale = await saleService.getById(req.params.id, req.ownerFilter, req.canSeeCostPrice, req.user);
    
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
    const sale = await saleService.cancel(req.params.id, req.ownerFilter, req.user._id, req.user);
    
    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (error) {
    next(error);
  }
};

exports.getWarehouseStock = async (req, res, next) => {
  try {
    const stock = await saleService.getWarehouseStock(req.params.warehouseId, req.user);

    res.status(200).json({
      success: true,
      data: stock
    });
  } catch (error) {
    next(error);
  }
};

exports.getDailySummary = async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const summary = await saleService.getDailySummary(req.user, req.query.branchId, date);
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};
