const mongoose = require('mongoose');

/**
 * A salesman for bonus tracking. The store has only a couple of login accounts
 * shared by 3–4 people, so the actual seller can't be inferred from the user
 * account — each sale records which Salesperson made it. The list is shared
 * store-wide (both owners' goods are sold by the same people).
 */
const salespersonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Satıcının adını daxil edin'],
    trim: true,
    maxlength: [100, 'Ad 100 simvoldan çox ola bilməz']
  },
  phone: {
    type: String,
    trim: true
  },
  // Bonus rate as a percentage of profit (e.g. 3 = 3%). The bonus is earned only
  // on the collected portion of each sale this salesperson made.
  bonusRate: {
    type: Number,
    default: 0,
    min: [0, 'Bonus dərəcəsi mənfi ola bilməz'],
    max: [100, 'Bonus dərəcəsi 100-dən çox ola bilməz']
  },
  note: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

salespersonSchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model('Salesperson', salespersonSchema);
