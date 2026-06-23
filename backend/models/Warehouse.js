const mongoose = require('mongoose');
const { WAREHOUSE_TYPES } = require('../config/constants');

const warehouseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Anbar adı daxil edin'],
    trim: true
  },
  code: {
    type: String,
    required: [true, 'Anbar kodu daxil edin'],
    unique: true,
    uppercase: true
  },
  type: {
    type: String,
    enum: Object.values(WAREHOUSE_TYPES),
    required: true
  },
  // A store / selling point: only these are pickable in New Sale. Stock is moved
  // into a store via Anbarlar Arası Transfer, then sold from it.
  isStore: {
    type: Boolean,
    default: false
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: function() {
      return this.type === WAREHOUSE_TYPES.BRANCH;
    }
  },
  address: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

warehouseSchema.statics.getMainWarehouse = async function() {
  return await this.findOne({ type: WAREHOUSE_TYPES.MAIN });
};

module.exports = mongoose.model('Warehouse', warehouseSchema);
