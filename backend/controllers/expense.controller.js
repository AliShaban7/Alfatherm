const expenseService = require('../services/expense.service');
const { ROLES } = require('../config/constants');

// Founders (OWNER) are scoped to their own (+ shared) expenses; the director
// (SUPER_OWNER) is scoped to null → sees and manages every owner's expenses.
const expenseScope = (req) => (req.user.role === ROLES.OWNER ? req.ownerId : null);

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
    const result = await expenseService.getAll(expenseScope(req), req.query);
    
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
    const expense = await expenseService.getById(req.params.id, expenseScope(req));
    
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
    const expense = await expenseService.update(req.params.id, req.body, expenseScope(req));
    
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
    const result = await expenseService.delete(req.params.id, expenseScope(req));
    
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
    const summary = await expenseService.getSummaryByCategory(expenseScope(req), branchId, startDate, endDate);
    
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
    const summary = await expenseService.getMonthlySummary(expenseScope(req), branchId, currentYear);
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};
