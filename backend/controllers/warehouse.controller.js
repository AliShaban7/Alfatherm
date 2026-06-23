const warehouseService = require('../services/warehouse.service');

exports.create = async (req, res, next) => {
  try {
    const warehouse = await warehouseService.create(req.body);
    
    res.status(201).json({
      success: true,
      data: warehouse
    });
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const warehouses = await warehouseService.getAll(req.query, req.canAccessMainWarehouse);
    
    res.status(200).json({
      success: true,
      data: warehouses
    });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const warehouse = await warehouseService.getById(req.params.id, req.canAccessMainWarehouse);
    
    res.status(200).json({
      success: true,
      data: warehouse
    });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const warehouse = await warehouseService.update(req.params.id, req.body, req.canAccessMainWarehouse);
    
    res.status(200).json({
      success: true,
      data: warehouse
    });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const result = await warehouseService.delete(req.params.id, req.canAccessMainWarehouse);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getMain = async (req, res, next) => {
  try {
    const warehouse = await warehouseService.getMainWarehouse();
    
    res.status(200).json({
      success: true,
      data: warehouse
    });
  } catch (error) {
    next(error);
  }
};
