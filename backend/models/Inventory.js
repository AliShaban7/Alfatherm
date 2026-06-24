const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  ownerId: {
    type: String,
    required: true,
    index: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
    // Negative allowed: store sales may oversell (goods not yet transferred from
    // the warehouse). The balance reconciles when stock is entered/transferred.
  },
  costPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  reservedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

inventorySchema.index({ productId: 1, warehouseId: 1 }, { unique: true });
inventorySchema.index({ ownerId: 1, warehouseId: 1 });

inventorySchema.virtual('availableQuantity').get(function() {
  return this.quantity - this.reservedQuantity;
});

inventorySchema.statics.getStockByProduct = async function(productId, ownerId) {
  return await this.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId), ownerId } },
    { $group: { _id: '$productId', totalStock: { $sum: '$quantity' } } }
  ]);
};

inventorySchema.statics.getStockByWarehouse = async function(warehouseId, ownerId) {
  // Sort after populate — sorting on a populated path at the DB layer is a no-op.
  const rows = await this.find({ warehouseId, ownerId })
    .populate('productId', 'name sku category')
    .lean();
  return rows.sort((a, b) =>
    (a.productId?.name || '').localeCompare(b.productId?.name || '', 'az')
  );
};

module.exports = mongoose.model('Inventory', inventorySchema);
