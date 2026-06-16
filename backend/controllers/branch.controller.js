const branchService = require('../services/branch.service');

exports.create = async (req, res, next) => {
  try {
    const branch = await branchService.create(req.body);
    
    res.status(201).json({
      success: true,
      data: branch
    });
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const branches = await branchService.getAll(req.query);
    
    res.status(200).json({
      success: true,
      data: branches
    });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const branch = await branchService.getById(req.params.id);
    
    res.status(200).json({
      success: true,
      data: branch
    });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const branch = await branchService.update(req.params.id, req.body);
    
    res.status(200).json({
      success: true,
      data: branch
    });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const result = await branchService.delete(req.params.id);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
