const mongoose = require('mongoose');
const { DEBT_STATUS } = require('../config/constants');

const paymentHistorySchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'pos', 'bank'],
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  note: String
}, { _id: true, timestamps: true });

const creditorSchema = new mongoose.Schema({
  // Owner isolation
  ownerId: {
    type: String,
    required: true,
    index: true
  },
  
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  
  // Reference to purchase if applicable
  purchaseOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder'
  },

  // Set when this debt came from a purchase invoice (Mal Girişi / faktura).
  purchaseInvoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseInvoice'
  },

  description: {
    type: String,
    required: [true, 'Təsvir daxil edin']
  },
  
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  remainingAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  status: {
    type: String,
    enum: Object.values(DEBT_STATUS),
    default: DEBT_STATUS.PENDING
  },
  
  dueDate: {
    type: Date
  },
  
  paymentHistory: [paymentHistorySchema],
  
  note: String,
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

creditorSchema.index({ ownerId: 1, status: 1 });
creditorSchema.index({ ownerId: 1, vendorId: 1 });
creditorSchema.index({ ownerId: 1, dueDate: 1 });

creditorSchema.pre('save', function(next) {
  // Round to cents so repeated payments don't accumulate floating-point drift.
  this.remainingAmount = Math.round((this.totalAmount - this.paidAmount) * 100) / 100;

  if (this.remainingAmount <= 0) {
    this.status = DEBT_STATUS.PAID;
  } else if (this.paidAmount > 0) {
    this.status = DEBT_STATUS.PARTIAL;
  } else if (this.dueDate && new Date() > this.dueDate) {
    this.status = DEBT_STATUS.OVERDUE;
  } else {
    // Not paid and not (any longer) past due → back to PENDING.
    this.status = DEBT_STATUS.PENDING;
  }

  next();
});

module.exports = mongoose.model('Creditor', creditorSchema);
