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
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  note: String
}, { _id: true, timestamps: true });

const debtorSchema = new mongoose.Schema({
  // Owner isolation
  ownerId: {
    type: String,
    required: true,
    index: true
  },
  
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true
  },
  
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
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

debtorSchema.index({ ownerId: 1, status: 1 });
debtorSchema.index({ ownerId: 1, customerId: 1 });
debtorSchema.index({ ownerId: 1, dueDate: 1 });

debtorSchema.pre('save', function(next) {
  this.remainingAmount = this.totalAmount - this.paidAmount;
  
  if (this.remainingAmount <= 0) {
    this.status = DEBT_STATUS.PAID;
  } else if (this.paidAmount > 0) {
    this.status = DEBT_STATUS.PARTIAL;
  } else if (this.dueDate && new Date() > this.dueDate) {
    this.status = DEBT_STATUS.OVERDUE;
  }
  
  next();
});

module.exports = mongoose.model('Debtor', debtorSchema);
