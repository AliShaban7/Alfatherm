const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Filial adı daxil edin'],
    trim: true
  },
  code: {
    type: String,
    required: [true, 'Filial kodu daxil edin'],
    unique: true,
    uppercase: true
  },
  address: {
    type: String,
    required: [true, 'Ünvan daxil edin']
  },
  phone: {
    type: String
  },
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

module.exports = mongoose.model('Branch', branchSchema);
