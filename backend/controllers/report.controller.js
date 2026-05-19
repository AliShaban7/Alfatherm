const reportService = require('../services/report.service');

exports.getDashboard = async (req, res, next) => {
  try {
    const summary = await reportService.getDashboardSummary(req.ownerId, req.query.branchId);
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

exports.getPeriodStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const stats = await reportService.getPeriodStats(req.ownerId, startDate, endDate);
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

exports.getSalesReport = async (req, res, next) => {
  try {
    const report = await reportService.getSalesReport(req.ownerId, req.query);
    
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

exports.getProductSalesReport = async (req, res, next) => {
  try {
    const report = await reportService.getProductSalesReport(req.ownerId, req.query);
    
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

exports.getInventoryReport = async (req, res, next) => {
  try {
    const report = await reportService.getInventoryReport(req.ownerId, req.canSeeCostPrice);
    
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

exports.getBranchReport = async (req, res, next) => {
  try {
    const report = await reportService.getBranchReport(req.ownerId, req.query);
    
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

exports.getProfitLossReport = async (req, res, next) => {
  try {
    const report = await reportService.getProfitLossReport(req.ownerId, req.query);
    
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};
