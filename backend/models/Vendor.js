const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Vendor adı daxil edin'],
    trim: true
  },
  companyName: {
    type: String,
    trim: true
  },
  voen: {
    type: String,
    trim: true,
    sparse: true
  },
  country: {
    type: String
  },
  address: {
    type: String
  },
  contactPerson: {
    type: String
  },
  phone: {
    type: String,
    required: [true, 'Telefon nömrəsi daxil edin']
  },
  email: {
    type: String,
    lowercase: true
  },
  
  // Owner who works with this vendor
  ownerId: {
    type: String,
    required: true,
    index: true
  },
  
  // Payment terms
  paymentTerms: {
    type: String
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
  
  note: String,
  
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

vendorSchema.index({ ownerId: 1, name: 'text' });

module.exports = mongoose.model('Vendor', vendorSchema);
