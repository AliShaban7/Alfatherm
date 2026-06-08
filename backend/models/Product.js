const mongoose = require('mongoose');
const Counter = require('./Counter');
const { PRODUCT_CATEGORIES, PRODUCT_UNITS } = require('../config/constants');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Məhsul adı daxil edin'],
    trim: true
  },
  sku: {
    type: String,
    required: true,
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

// Auto-generate a globally-unique SKU (used only when none is entered manually).
// Format: PRD-<OWNERCODE>-NNNN, e.g. PRD-ZAU-0007.
//
// SKUs are globally unique, but the two owners' ids both start with "owne",
// so the old substring(0,4) prefix + per-owner sequence produced colliding
// numbers (both got PRD-OWNE-0001). Two defences here:
//   1. A distinct owner code derived from the id (zaur -> ZAU, adalat -> ADA).
//   2. An atomic Counter keyed by the prefix — so even if two owners ever
//      mapped to the same code, the shared sequence still yields unique numbers
//      with no race between concurrent creates.
// The loop additionally skips any number already taken by a manually-typed SKU.
productSchema.statics.generateSKU = async function(ownerId) {
  const segment = String(ownerId).split('_')[1] || String(ownerId);
  const ownerCode = segment.slice(0, 3).toUpperCase() || 'GEN';
  const prefix = `PRD-${ownerCode}`;

  let sku;
  do {
    const seq = await Counter.next(`sku:${prefix}`);
    sku = `${prefix}-${seq.toString().padStart(4, '0')}`;
  } while (await this.exists({ sku }));

  return sku;
};

module.exports = mongoose.model('Product', productSchema);
