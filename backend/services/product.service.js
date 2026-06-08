const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const { ROLES } = require('../config/constants');

class ProductService {
  async create(productData, ownerId, userId) {
    // Auto-generate SKU if not provided
    let sku = productData.sku;
    if (!sku) {
      sku = await Product.generateSKU(ownerId);
    } else {
      sku = sku.toUpperCase();
      // SKU is globally unique, so check across all owners — otherwise a clash
      // with the other owner's SKU would surface as a raw DB error on save.
      const existingProduct = await Product.findOne({ sku });
      if (existingProduct) {
        throw new Error('Bu SKU ilə məhsul artıq mövcuddur');
      }
    }

    // Set default costPrice if not provided
    const costPrice = productData.costPrice || 0;

    // Min price must cover cost — otherwise employees could sell at a loss,
    // which is exactly what min-price protection exists to prevent. (Mirrors
    // the same guard in update().)
    if (productData.minPrice !== undefined && productData.minPrice < costPrice) {
      throw new Error('Minimum qiymət maya dəyərindən az ola bilməz');
    }

    const product = await Product.create({
      ...productData,
      sku,
      costPrice,
      ownerId,
      createdBy: userId
    });

    return product;
  }

  async getAll(ownerId, filters = {}, canSeeCostPrice = false, user = null) {
    const query = { isActive: true };
    
    if (user?.role !== ROLES.SUPER_OWNER && user?.role !== ROLES.EMPLOYEE) {
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

  // Owner filter for a single-resource lookup. Super owner (director) and, for
  // read paths, employees may act on any owner's products; founders are scoped.
  _ownerScope(ownerId, user, allowEmployee = false) {
    if (user?.role === ROLES.SUPER_OWNER) return {};
    if (allowEmployee && user?.role === ROLES.EMPLOYEE) return {};
    return { ownerId };
  }

  async getById(id, ownerId, canSeeCostPrice = false, user = null) {
    const product = await Product.findOne({ _id: id, ...this._ownerScope(ownerId, user, true) });

    if (!product) {
      throw new Error('Məhsul tapılmadı');
    }

    if (!canSeeCostPrice) {
      return product.toEmployeeJSON();
    }

    return product;
  }

  async update(id, updateData, ownerId, canSeeCostPrice = false, user = null) {
    if (!canSeeCostPrice) {
      delete updateData.costPrice;
    }

    const scope = this._ownerScope(ownerId, user);

    // A product's owner must never change via an update.
    delete updateData.ownerId;

    // Fetch existing product to validate price relationships
    const existingProduct = await Product.findOne({ _id: id, ...scope });
    if (!existingProduct) {
      throw new Error('Məhsul tapılmadı');
    }

    // Get the final values (use updateData if provided, otherwise use existing)
    const finalMinPrice = updateData.minPrice !== undefined ? updateData.minPrice : existingProduct.minPrice;
    const finalRecommendedPrice = updateData.recommendedPrice !== undefined ? updateData.recommendedPrice : existingProduct.recommendedPrice;
    const finalCostPrice = updateData.costPrice !== undefined ? updateData.costPrice : existingProduct.costPrice;

    // Validate price relationships with final values
    if (finalMinPrice < finalCostPrice) {
      throw new Error('Minimum qiymət maya dəyərindən az ola bilməz');
    }

    if (finalRecommendedPrice < finalMinPrice) {
      throw new Error('Tövsiyə olunan qiymət minimum qiymətdən az ola bilməz');
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, ...scope },
      updateData,
      { new: true, runValidators: false }  // Disable validators since we're doing manual validation
    );

    if (!product) {
      throw new Error('Məhsul tapılmadı');
    }

    return canSeeCostPrice ? product : product.toEmployeeJSON();
  }

  async delete(id, ownerId, user = null) {
    // Block deletion if any warehouse still holds stock of this product
    // (scoped to the product's owner via the stock rows themselves).
    const inventory = await Inventory.findOne({
      productId: id,
      quantity: { $gt: 0 }
    });

    if (inventory) {
      throw new Error('Stokda olan məhsul silinə bilməz');
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, ...this._ownerScope(ownerId, user) },
      { isActive: false },
      { new: true }
    );

    if (!product) {
      throw new Error('Məhsul tapılmadı');
    }

    return { message: 'Məhsul uğurla silindi' };
  }

  async getProductWithStock(id, ownerId, canSeeCostPrice = false, user = null) {
    const product = await Product.findOne({ _id: id, ...this._ownerScope(ownerId, user, true) }).lean();

    if (!product) {
      throw new Error('Məhsul tapılmadı');
    }

    // Stock rows belong to the product's owner; match the product, not the viewer.
    const inventory = await Inventory.find({ productId: id, ownerId: product.ownerId })
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
