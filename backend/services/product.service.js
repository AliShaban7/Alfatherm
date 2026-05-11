const Product = require('../models/Product');
const Inventory = require('../models/Inventory');

class ProductService {
  async create(productData, ownerId, userId) {
    const existingProduct = await Product.findOne({ 
      sku: productData.sku.toUpperCase(),
      ownerId 
    });
    
    if (existingProduct) {
      throw new Error('Bu SKU ilə məhsul artıq mövcuddur');
    }

    const product = await Product.create({
      ...productData,
      sku: productData.sku.toUpperCase(),
      ownerId,
      createdBy: userId
    });

    return product;
  }

  async getAll(ownerId, filters = {}, canSeeCostPrice = false, user = null) {
    const query = { isActive: true };
    
    if (user?.role !== 'salesperson') {
      query.ownerId = ownerId;
    }

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { sku: { $regex: filters.search, $options: 'i' } },
        { brand: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const skip = (page - 1) * limit;

    let selectFields = '-__v';
    if (!canSeeCostPrice) {
      selectFields += ' -costPrice';
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .select(selectFields)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query)
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getById(id, ownerId, canSeeCostPrice = false) {
    const product = await Product.findOne({ _id: id, ownerId });

    if (!product) {
      throw new Error('Məhsul tapılmadı');
    }

    if (!canSeeCostPrice) {
      return product.toEmployeeJSON();
    }

    return product;
  }

  async update(id, updateData, ownerId, canSeeCostPrice = false) {
    if (!canSeeCostPrice) {
      delete updateData.costPrice;
    }

    if (updateData.minPrice !== undefined && updateData.costPrice !== undefined) {
      if (updateData.minPrice < updateData.costPrice) {
        throw new Error('Minimum qiymət maya dəyərindən az ola bilməz');
      }
    }

    if (updateData.recommendedPrice !== undefined && updateData.minPrice !== undefined) {
      if (updateData.recommendedPrice < updateData.minPrice) {
        throw new Error('Tövsiyə olunan qiymət minimum qiymətdən az ola bilməz');
      }
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, ownerId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      throw new Error('Məhsul tapılmadı');
    }

    return canSeeCostPrice ? product : product.toEmployeeJSON();
  }

  async delete(id, ownerId) {
    const inventory = await Inventory.findOne({ 
      productId: id, 
      ownerId,
      quantity: { $gt: 0 }
    });

    if (inventory) {
      throw new Error('Stokda olan məhsul silinə bilməz');
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, ownerId },
      { isActive: false },
      { new: true }
    );

    if (!product) {
      throw new Error('Məhsul tapılmadı');
    }

    return { message: 'Məhsul uğurla silindi' };
  }

  async getProductWithStock(id, ownerId, canSeeCostPrice = false) {
    const product = await Product.findOne({ _id: id, ownerId }).lean();

    if (!product) {
      throw new Error('Məhsul tapılmadı');
    }

    const inventory = await Inventory.find({ productId: id, ownerId })
      .populate('warehouseId', 'name code type')
      .lean();

    const totalStock = inventory.reduce((sum, inv) => sum + inv.quantity, 0);

    if (!canSeeCostPrice) {
      delete product.costPrice;
    }

    return {
      ...product,
      totalStock,
      stockByWarehouse: inventory.map(inv => ({
        warehouse: inv.warehouseId,
        quantity: inv.quantity
      }))
    };
  }
}

module.exports = new ProductService();
