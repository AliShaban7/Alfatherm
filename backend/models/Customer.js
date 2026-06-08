const mongoose = require('mongoose');
const { CUSTOMER_TYPES } = require('../config/constants');

const customerSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: Object.values(CUSTOMER_TYPES),
    required: [true, 'Müştəri tipi seçin']
  },
  name: {
    type: String,
    required: [true, 'Ad daxil edin'],
    trim: true
  },
  brandName: {
    type: String,
    trim: true
  },
  voen: {
    type: String,
    trim: true
  },
  fin: {
    type: String,
    trim: true,
    uppercase: true
  },
  address: {
    type: String
  },
  contactPerson: {
    type: String
  },
  phone: {
    type: String,
    required: [true, 'Telefon nömrəsi daxil edin'],
    trim: true
  },
  email: {
    type: String,
    lowercase: true
  },
  note: {
    type: String
  },
  
  // Track which owner's customer
  ownerId: {
    type: String,
    required: true,
    index: true
  },
  
  // Statistics
  totalPurchases: {
    type: Number,
    default: 0
  },
  totalDebt: {
    type: Number,
    default: 0
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
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

customerSchema.index({ ownerId: 1, name: 'text' });
customerSchema.index({ ownerId: 1, type: 1 });

customerSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);
customerSchema.index(
  { voen: 1 },
  { unique: true, partialFilterExpression: { isActive: true, voen: { $type: 'string', $nin: [null, ''] } } }
);
customerSchema.index(
  { fin: 1 },
  { unique: true, partialFilterExpression: { isActive: true, fin: { $type: 'string', $nin: [null, ''] } } }
);

module.exports = mongoose.model('Customer', customerSchema);
