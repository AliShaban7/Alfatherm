const mongoose = require('mongoose');
const { PAYMENT_TYPES, PAYMENT_METHODS } = require('../config/constants');

const saleItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Miqdar minimum 1 olmalıdır']
  },
  unitPrice: {
    type: Number,
    required: true,
    min: [0, 'Qiymət mənfi ola bilməz']
  },
  minPrice: {
    type: Number,
    required: true
  },
  costPrice: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  }
}, { _id: false });

const saleSchema = new mongoose.Schema({
  saleNumber: {
    type: String,
    required: true,
    unique: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  
  // Owner isolation - CRITICAL
  ownerId: {
    type: String,
    required: true,
    index: true
  },
  
  // User who made the sale
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Auto-assigned from user
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  
  // Source warehouse
  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  
  // Customer
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  
  // Items
  items: {
    type: [saleItemSchema],
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'Satışda minimum 1 məhsul olmalıdır'
    }
  },
  
  // Totals
  subtotal: {
    type: Number,
    required: true
  },
  totalDiscount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  totalCost: {
    type: Number,
    required: true
  },
  profit: {
    type: Number,
    required: true
  },
  
  // Payment
  paymentType: {
    type: String,
    enum: Object.values(PAYMENT_TYPES),
    required: true
  },
  paymentMethod: {
    type: String,
    enum: Object.values(PAYMENT_METHODS),
    required: function() {
      return this.paymentType === PAYMENT_TYPES.PREPAID;
    }
  },
  
  // Partial payment for credit sales
  paidAmount: {
    type: Number,
    default: 0
  },
  remainingAmount: {
    type: Number,
    default: 0
  },
  
  // Tax/Official record
  isOfficial: {
    type: Boolean,
    default: false
  },
  
  // Status
  status: {
    type: String,
    enum: ['completed', 'cancelled', 'returned'],
    default: 'completed'
  },
  
  note: {
    type: String
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

saleSchema.index({ ownerId: 1, date: -1 });
saleSchema.index({ ownerId: 1, branchId: 1, date: -1 });
saleSchema.index({ ownerId: 1, customerId: 1 });

saleSchema.pre('save', function(next) {
  if (this.paymentType === PAYMENT_TYPES.CREDIT) {
    this.remainingAmount = this.totalAmount - this.paidAmount;
  }
  next();
});

saleSchema.statics.generateSaleNumber = async function(branchCode) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `${branchCode || 'SAL'}-${dateStr}`;
  
  const lastSale = await this.findOne({
    saleNumber: new RegExp(`^${prefix}`)
  }).sort({ saleNumber: -1 });
  
  let sequence = 1;
  if (lastSale) {
    const lastNum = parseInt(lastSale.saleNumber.split('-').pop());
    sequence = lastNum + 1;
  }
  
  return `${prefix}-${sequence.toString().padStart(4, '0')}`;
};

module.exports = mongoose.model('Sale', saleSchema);
