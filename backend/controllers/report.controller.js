const reportService = require('../services/report.service');

exports.getDashboard = async (req, res, next) => {
  try {
    const summary = await reportService.getDashboardSummary(req.user, req.query.branchId);
    
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
    const stats = await reportService.getPeriodStats(req.user, startDate, endDate);
    
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
    const report = await reportService.getSalesReport(req.user, req.query);
    
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
    const report = await reportService.getProductSalesReport(req.user, req.query);
    
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
    const report = await reportService.getInventoryReport(req.user, req.canSeeCostPrice);
    
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
    const report = await reportService.getBranchReport(req.user, req.query);
    
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

exports.getSalespersonReport = async (req, res, next) => {
  try {
    const report = await reportService.getSalespersonReport(req.user, req.query);

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
    const report = await reportService.getProfitLossReport(req.user, req.query);
    
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};
