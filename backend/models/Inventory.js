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
    default: 0,
    min: [0, 'Stok mənfi ola bilməz']
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
  return await this.find({ warehouseId, ownerId })
    .populate('productId', 'name sku category')
    .sort({ 'productId.name': 1 });
};

module.exports = mongoose.model('Inventory', inventorySchema);
