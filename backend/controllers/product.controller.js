const productService = require('../services/product.service');
const { ROLES } = require('../config/constants');

exports.create = async (req, res, next) => {
  try {
    // Director and salespeople pick the owning founder (products belong to a
    // founder, never the store); a founder creates under themselves.
    const canChooseOwner =
      req.user.role === ROLES.SUPER_OWNER || req.user.role === ROLES.EMPLOYEE;
    const ownerId = canChooseOwner && req.body.ownerId
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

// Distinct existing values for the New Product pick-or-add-new fields.
exports.getOptions = async (req, res, next) => {
  try {
    const options = await productService.getFieldOptions();
    res.status(200).json({ success: true, data: options });
  } catch (error) {
    next(error);
  }
};

// Bulk import products from an Excel file (rows normalized on the client).
exports.importProducts = async (req, res, next) => {
  try {
    const result = await productService.importProducts(req.body.products, req.user, req.ownerId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const product = await productService.getById(req.params.id, req.ownerId, req.canSeeCostPrice, req.user);
    
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
    const product = await productService.getProductWithStock(req.params.id, req.ownerId, req.canSeeCostPrice, req.user);
    
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
    const product = await productService.update(req.params.id, req.body, req.ownerId, req.canSeeCostPrice, req.user);
    
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
    const result = await productService.delete(req.params.id, req.ownerId, req.user);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
