const mongoose = require('mongoose');
const Counter = require('./Counter');
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
  // Which owner this specific line item belongs to (its product's owner).
  // Lets a single sale that mixes owners' products attribute each line correctly.
  productOwnerId: {
    type: String,
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
  // Primary owner = the customer's owner. Anchors the receipt, customer link,
  // and (for a single-owner sale) all reporting.
  ownerId: {
    type: String,
    required: true,
    index: true
  },

  // Distinct set of product owners represented in `items`. For a single-owner
  // sale this equals [ownerId]. For a mixed sale it holds every owner whose
  // goods were sold, so each owner's queries can find the sale (multikey index).
  ownerIds: {
    type: [String],
    index: true,
    default: undefined
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

  // Salesman who made the sale (for bonus tracking). The login account can't
  // identify them — several people share each account — so it's chosen at
  // checkout. Required on create is enforced in the validator/service, not here,
  // so saving legacy sales (e.g. cancel) doesn't fail.
  salespersonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Salesperson',
    index: true
  },
  // Snapshot of the name at sale time, so reports/receipts stay correct even if
  // the salesman is later renamed or deactivated.
  salespersonName: {
    type: String
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

saleSchema.index({ date: -1 }); // global sales list sort (employee / super owner)
saleSchema.index({ ownerId: 1, date: -1 });
saleSchema.index({ ownerId: 1, branchId: 1, date: -1 });
saleSchema.index({ ownerId: 1, customerId: 1 });
saleSchema.index({ salespersonId: 1, date: -1 });
saleSchema.index({ ownerIds: 1, date: -1 });

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

  // Atomic per-prefix counter: safe for simultaneous sales across stores.
  // (Done outside the sale's transaction so a rare abort just leaves a gap in
  // the numbering rather than risking a duplicate number.)
  const sequence = await Counter.next(prefix);

  return `${prefix}-${sequence.toString().padStart(4, '0')}`;
};

module.exports = mongoose.model('Sale', saleSchema);
