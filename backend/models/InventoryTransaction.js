const mongoose = require('mongoose');
const { INVENTORY_TRANSACTION_TYPES } = require('../config/constants');

const inventoryTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: Object.values(INVENTORY_TRANSACTION_TYPES),
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  ownerId: {
    type: String,
    required: true,
    index: true
  },
  fromWarehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse'
  },
  toWarehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse'
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Miqdar minimum 1 olmalıdır']
  },
  costPrice: {
    type: Number,
    min: 0
  },
  salePrice: {
    type: Number,
    min: 0
  },
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale'
  },
  purchaseOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder'
  },
  purchaseInvoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseInvoice'
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor'
  },
  creditorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Creditor'
  },
  note: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

inventoryTransactionSchema.index({ ownerId: 1, type: 1, createdAt: -1 });
inventoryTransactionSchema.index({ productId: 1, createdAt: -1 });

inventoryTransactionSchema.pre('validate', function(next) {
  const { IN, TRANSFER, SALE, RETURN } = INVENTORY_TRANSACTION_TYPES;
  
  if (this.type === IN && !this.toWarehouseId) {
    return next(new Error('Mal girişi üçün anbar seçilməlidir'));
  }
  
  if (this.type === TRANSFER && (!this.fromWarehouseId || !this.toWarehouseId)) {
    return next(new Error('Transfer üçün hər iki anbar seçilməlidir'));
  }
  
  if (this.type === SALE && !this.fromWarehouseId) {
    return next(new Error('Satış üçün anbar seçilməlidir'));
  }
  
  next();
});

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
