const categoryService = require('../services/category.service');

exports.getAll = async (req, res, next) => {
  try {
    const { type } = req.query;
    const categories = await categoryService.getAll(type);
    
    // Get product counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat) => {
        const count = await categoryService.getProductCount(cat.code);
        return {
          ...cat.toObject(),
          productCount: count
        };
      })
    );
    
    res.json({
      success: true,
      data: categoriesWithCounts
    });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const category = await categoryService.create(req.body, req.user.id);
    
    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const category = await categoryService.update(req.params.id, req.body);
    
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await categoryService.delete(req.params.id);
    
    res.json({
      success: true,
      message: 'Kateqoriya silindi'
    });
  } catch (error) {
    next(error);
  }
};
