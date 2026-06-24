const salespersonService = require('../services/salesperson.service');

exports.create = async (req, res, next) => {
  try {
    const salesperson = await salespersonService.create(req.body, req.user._id);
    res.status(201).json({ success: true, data: salesperson });
  } catch (error) {
    next(error);
  }
};

// Self-service: the logged-in salesperson's own performance and customers.
exports.getMySummary = async (req, res, next) => {
  try {
    const data = await salespersonService.getMyStats(req.user, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getMyCustomers = async (req, res, next) => {
  try {
    const data = await salespersonService.getMyCustomers(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// Per salesperson-tag stats + per-tag debtors (visible to salesperson accounts).
exports.getTagStats = async (req, res, next) => {
  try {
    const data = await salespersonService.getTagStats(req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getTagDebtors = async (req, res, next) => {
  try {
    const data = await salespersonService.getTagDebtors(req.params.id, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const salespersons = await salespersonService.getAll(req.query);
    res.status(200).json({ success: true, data: salespersons });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const salesperson = await salespersonService.getById(req.params.id);
    res.status(200).json({ success: true, data: salesperson });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const salesperson = await salespersonService.update(req.params.id, req.body);
    res.status(200).json({ success: true, data: salesperson });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const result = await salespersonService.delete(req.params.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
