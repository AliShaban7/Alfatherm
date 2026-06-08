const inventoryService = require('../services/inventory.service');
const { ROLES } = require('../config/constants');

exports.productEntry = async (req, res, next) => {
  try {
    // Super owner can specify ownerId in body, otherwise use req.ownerId
    const ownerId = req.user.role === ROLES.SUPER_OWNER && req.body.ownerId
      ? req.body.ownerId
      : req.ownerId;
    
    const result = await inventoryService.productEntry(
      req.body,
      ownerId,
      req.user._id,
      req.canAccessMainWarehouse
    );
    
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.transfer = async (req, res, next) => {
  try {
    const result = await inventoryService.transfer(
      req.body,
      req.ownerId,
      req.user._id,
      req.canAccessMainWarehouse,
      req.user
    );
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getByWarehouse = async (req, res, next) => {
  try {
    const result = await inventoryService.getByWarehouse(
      req.params.warehouseId,
      req.ownerId,
      req.canSeeCostPrice,
      req.user
    );
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const result = await inventoryService.getAll(req.ownerId, req.canSeeCostPrice, req.user);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getTransactions = async (req, res, next) => {
  try {
    const result = await inventoryService.getTransactions(req.ownerId, req.query, req.user);
    
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const result = await inventoryService.update(
      req.params.id,
      req.body,
      req.ownerId,
      req.user._id,
      req.user
    );
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await inventoryService.delete(
      req.params.id,
      req.ownerId,
      req.user._id,
      req.user
    );
    
    res.status(200).json({
      success: true,
      message: 'Stok silindi'
    });
  } catch (error) {
    next(error);
  }
};
