const salespersonService = require('../services/salesperson.service');

exports.create = async (req, res, next) => {
  try {
    const salesperson = await salespersonService.create(req.body, req.user._id);
    res.status(201).json({ success: true, data: salesperson });
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
