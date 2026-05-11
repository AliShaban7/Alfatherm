const mongoose = require('mongoose');
const { PRODUCT_CATEGORIES, PRODUCT_UNITS } = require('../config/constants');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Məhsul adı daxil edin'],
    trim: true
  },
  sku: {
    type: String,
    required: [true, 'SKU daxil edin'],
    unique: true,
    uppercase: true
  },
  barcode: {
    type: String,
    sparse: true
  },
  brand: {
    type: String,
    trim: true
  },
  manufacturer: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: Object.values(PRODUCT_CATEGORIES),
    required: [true, 'Kateqoriya seçin']
  },
  unit: {
    type: String,
    enum: Object.values(PRODUCT_UNITS),
    default: PRODUCT_UNITS.PIECE
  },
  color: {
    type: String,
    trim: true
  },
  description: {
    type: String
  },
  
  // PRICING - Critical fields
  costPrice: {
    type: Number,
    min: [0, 'Maya dəyəri mənfi ola bilməz'],
    default: 0
  },
  minPrice: {
    type: Number,
    required: [true, 'Minimum qiymət daxil edin'],
    min: [0, 'Minimum qiymət mənfi ola bilməz']
  },
  recommendedPrice: {
    type: Number,
    required: [true, 'Tövsiyə olunan qiymət daxil edin'],
    validate: {
      validator: function(value) {
        return value >= this.minPrice;
      },
      message: 'Tövsiyə olunan qiymət minimum qiymətdən az ola bilməz'
    }
  },

  // OWNER - Critical for data isolation
  ownerId: {
    type: String,
    required: [true, 'Owner ID tələb olunur'],
    index: true
  },

  // Vendor reference
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor'
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

productSchema.index({ ownerId: 1, sku: 1 });
productSchema.index({ ownerId: 1, name: 'text' });
productSchema.index({ ownerId: 1, category: 1 });

productSchema.methods.toEmployeeJSON = function() {
  const obj = this.toObject();
  delete obj.costPrice;
  return obj;
};

module.exports = mongoose.model('Product', productSchema);
