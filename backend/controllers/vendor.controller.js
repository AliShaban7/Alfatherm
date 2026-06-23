const vendorService = require('../services/vendor.service');

exports.create = async (req, res, next) => {
  try {
    const vendor = await vendorService.create(req.body, req.ownerId, req.user._id);
    
    res.status(201).json({
      success: true,
      data: vendor
    });
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const result = await vendorService.getAll(req.ownerId, req.query);
    
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
    const vendor = await vendorService.getById(req.params.id, req.ownerId);
    
    res.status(200).json({
      success: true,
      data: vendor
    });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const vendor = await vendorService.update(req.params.id, req.body, req.ownerId);
    
    res.status(200).json({
      success: true,
      data: vendor
    });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const result = await vendorService.delete(req.params.id, req.ownerId);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
