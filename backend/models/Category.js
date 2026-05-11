const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Kateqoriya adı daxil edin'],
    trim: true
  },
  code: {
    type: String,
    required: [true, 'Kateqoriya kodu daxil edin'],
    unique: true,
    lowercase: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['product', 'expense'],
    default: 'product'
  },
  isSystem: {
    type: Boolean,
    default: false
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

categorySchema.index({ code: 1, type: 1 });

module.exports = mongoose.model('Category', categorySchema);
