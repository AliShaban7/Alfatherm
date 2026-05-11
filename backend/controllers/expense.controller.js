const expenseService = require('../services/expense.service');

exports.create = async (req, res, next) => {
  try {
    const expense = await expenseService.create(req.body, req.ownerId, req.user._id);
    
    res.status(201).json({
      success: true,
      data: expense
    });
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const result = await expenseService.getAll(req.ownerId, req.query);
    
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
    const expense = await expenseService.getById(req.params.id);
    
    res.status(200).json({
      success: true,
      data: expense
    });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const expense = await expenseService.update(req.params.id, req.body, req.ownerId);
    
    res.status(200).json({
      success: true,
      data: expense
    });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const result = await expenseService.delete(req.params.id, req.ownerId);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getSummaryByCategory = async (req, res, next) => {
  try {
    const { branchId, startDate, endDate } = req.query;
    const summary = await expenseService.getSummaryByCategory(req.ownerId, branchId, startDate, endDate);
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

exports.getMonthlySummary = async (req, res, next) => {
  try {
    const { branchId, year } = req.query;
    const currentYear = year || new Date().getFullYear();
    const summary = await expenseService.getMonthlySummary(req.ownerId, branchId, currentYear);
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};
