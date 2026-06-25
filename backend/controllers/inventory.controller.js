const inventoryService = require('../services/inventory.service');
const { ROLES } = require('../config/constants');

// Bulk stock load from Excel (rows normalized on the client).
exports.importStock = async (req, res, next) => {
  try {
    const result = await inventoryService.importStock(req.body.rows, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.productEntry = async (req, res, next) => {
  try {
    // Super owner and sales accounts (who import goods on behalf of an owner) may
    // pick the owner per entry; founders are pinned to their own. The service still
    // requires the product to belong to the chosen owner, so this can't mis-file.
    const canChooseOwner =
      req.user.role === ROLES.SUPER_OWNER || req.user.role === ROLES.EMPLOYEE;
    const ownerId = canChooseOwner && req.body.ownerId
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

exports.transferBulk = async (req, res, next) => {
  try {
    const result = await inventoryService.transferBulk(
      req.body,
      req.ownerId,
      req.user._id,
      req.canAccessMainWarehouse,
      req.user
    );
    res.status(200).json({ success: true, data: result });
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
