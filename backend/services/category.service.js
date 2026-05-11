const Category = require('../models/Category');
const Product = require('../models/Product');

exports.getAll = async (type = 'product') => {
  const categories = await Category.find({ type }).sort({ name: 1 });
  return categories;
};

exports.create = async (data, userId) => {
  const category = await Category.create({
    ...data,
    createdBy: userId
  });
  return category;
};

exports.update = async (id, data) => {
  const category = await Category.findById(id);
  
  if (!category) {
    throw new Error('Kateqoriya tapılmadı');
  }
  
  if (category.isSystem) {
    throw new Error('Sistem kateqoriyalarını dəyişdirmək mümkün deyil');
  }
  
  Object.assign(category, data);
  await category.save();
  
  return category;
};

exports.delete = async (id) => {
  const category = await Category.findById(id);
  
  if (!category) {
    throw new Error('Kateqoriya tapılmadı');
  }
  
  if (category.isSystem) {
    throw new Error('Sistem kateqoriyalarını silmək mümkün deyil');
  }
  
  // Check if category is used in products
  const productsCount = await Product.countDocuments({ category: category.code });
  if (productsCount > 0) {
    throw new Error(`Bu kateqoriya ${productsCount} məhsulda istifadə olunur. Əvvəlcə məhsulları silin və ya kateqoriyalarını dəyişin`);
  }
  
  await Category.findByIdAndDelete(id);
  
  return { success: true };
};

exports.getProductCount = async (categoryCode) => {
  const count = await Product.countDocuments({ category: categoryCode });
  return count;
};
