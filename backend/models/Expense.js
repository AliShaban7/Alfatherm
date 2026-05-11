const mongoose = require('mongoose');
const { EXPENSE_CATEGORIES } = require('../config/constants');

const expenseSchema = new mongoose.Schema({
  // Auto-generated expense number
  expenseNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // Owner isolation - expenses might be shared or separate
  ownerId: {
    type: String,
    index: true
  },
  
  // If shared expense between owners
  isShared: {
    type: Boolean,
    default: false
  },
  
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  
  category: {
    type: String,
    enum: Object.values(EXPENSE_CATEGORIES),
    required: [true, 'Kateqoriya seçin']
  },
  
  description: {
    type: String,
    required: [true, 'Təsvir daxil edin']
  },
  
  amount: {
    type: Number,
    required: [true, 'Məbləğ daxil edin'],
    min: [0, 'Məbləğ mənfi ola bilməz']
  },
  
  date: {
    type: Date,
    default: Date.now
  },
  
  paymentMethod: {
    type: String,
    enum: ['cash', 'pos', 'bank'],
    default: 'cash'
  },
  
  // Recurring expense tracking
  isRecurring: {
    type: Boolean,
    default: false
  },
  
  recurringPeriod: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly']
  },
  
  // Supporting documents
  receiptNumber: String,
  attachments: [String],
  
  note: String,
  
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

expenseSchema.index({ branchId: 1, date: -1 });
expenseSchema.index({ category: 1, date: -1 });
expenseSchema.index({ ownerId: 1, date: -1 });

// Auto-generate expense number before saving
expenseSchema.pre('save', async function(next) {
  if (this.isNew && !this.expenseNumber) {
    const count = await mongoose.model('Expense').countDocuments();
    this.expenseNumber = `XRC-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Expense', expenseSchema);
