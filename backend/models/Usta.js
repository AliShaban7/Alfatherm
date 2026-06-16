const mongoose = require('mongoose');

/**
 * An usta (engineer / master tradesman) who refers customers and earns a
 * referral commission. Ustas have NO login account — they're registered
 * contacts, like vendors. The list is shared store-wide (a referral may send a
 * customer who buys both owners' goods), so there is no `ownerId` here. What
 * each owner owes an usta lives in the per-owner `Commission` ledger; an usta's
 * balance is derived from it, never stored on this document.
 */
const ustaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Ustanın adını daxil edin'],
    trim: true,
    maxlength: [100, 'Ad 100 simvoldan çox ola bilməz']
  },
  phone: {
    type: String,
    trim: true
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

ustaSchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model('Usta', ustaSchema);
