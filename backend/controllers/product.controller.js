const productService = require('../services/product.service');

exports.create = async (req, res, next) => {
  try {
    // Super owner can specify ownerId in body, otherwise use req.ownerId
    const ownerId = req.user.role === 'SUPER_OWNER' && req.body.ownerId 
      ? req.body.ownerId 
      : req.ownerId;
    
    const product = await productService.create(req.body, ownerId, req.user._id);
    
    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const result = await productService.getAll(req.ownerId, req.query, req.canSeeCostPrice, req.user);
    
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
    const product = await productService.getById(req.params.id, req.ownerId, req.canSeeCostPrice);
    
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

exports.getWithStock = async (req, res, next) => {
  try {
    const product = await productService.getProductWithStock(req.params.id, req.ownerId, req.canSeeCostPrice);
    
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const product = await productService.update(req.params.id, req.body, req.ownerId, req.canSeeCostPrice);
    
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const result = await productService.delete(req.params.id, req.ownerId);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
