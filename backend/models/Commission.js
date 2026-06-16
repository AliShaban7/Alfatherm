const mongoose = require('mongoose');
const { DEBT_STATUS } = require('../config/constants');

// Payment against an usta's referral commission. Same shape as the Creditor
// payment history — a cash settlement, not a P&L expense (the commission cost
// was already booked at the sale, see report.service commission accrual).
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

/**
 * One owner's share of the referral commission owed to an usta for a single
 * sale. Mirrors the Creditor (accounts-payable) pattern: it accrues at sale
 * time (one record per owner whose goods were in the sale, split by item share)
 * and is drawn down by payments in the Expenses panel. The usta's outstanding
 * balance is the sum of `remainingAmount` across their open records.
 */
const commissionSchema = new mongoose.Schema({
  ustaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usta',
    required: true
  },
  // Snapshot so reports/balances stay correct if the usta is later renamed.
  ustaName: {
    type: String
  },

  // The owner who owes this slice of the commission.
  ownerId: {
    type: String,
    required: true,
    index: true
  },

  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },

  amount: {
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

  paymentHistory: [paymentHistorySchema],

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

commissionSchema.index({ ustaId: 1, ownerId: 1, status: 1 });
commissionSchema.index({ ownerId: 1, status: 1 });
commissionSchema.index({ saleId: 1 });

commissionSchema.pre('save', function(next) {
  this.remainingAmount = this.amount - this.paidAmount;

  if (this.remainingAmount <= 0) {
    this.status = DEBT_STATUS.PAID;
  } else if (this.paidAmount > 0) {
    this.status = DEBT_STATUS.PARTIAL;
  } else {
    this.status = DEBT_STATUS.PENDING;
  }

  next();
});

module.exports = mongoose.model('Commission', commissionSchema);
