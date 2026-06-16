const mongoose = require('mongoose');
const Counter = require('./Counter');

// One product line on a purchase invoice (faktura). Cost is per unit.
const invoiceItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: { type: String, required: true }, // snapshot at entry time
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Miqdar minimum 1 olmalıdır']
  },
  costPrice: {
    type: Number,
    required: true,
    min: [0, 'Maya dəyəri mənfi ola bilməz']
  },
  total: { type: Number, required: true } // quantity * costPrice
}, { _id: false });

/**
 * A purchase invoice (faktura): a single goods-receipt from one vendor into one
 * warehouse, containing several products. On creation it updates stock (weighted
 * average cost) and logs an IN transaction per line. Payment is per-invoice: any
 * unpaid remainder becomes a single linked Creditor (vendor debt), so the
 * existing Creditors/dashboard/reports machinery handles settlement.
 */
const purchaseInvoiceSchema = new mongoose.Schema({
  // Internal sequential number (FAK-YYYYMMDD-NNNN).
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  // The vendor's own invoice/faktura number (optional, as printed on their doc).
  vendorInvoiceNumber: {
    type: String,
    trim: true
  },

  ownerId: {
    type: String,
    required: true,
    index: true
  },

  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  vendorName: { type: String },

  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  warehouseName: { type: String },

  date: {
    type: Date,
    default: Date.now
  },

  items: {
    type: [invoiceItemSchema],
    validate: {
      validator: (items) => items && items.length > 0,
      message: 'Fakturada minimum 1 məhsul olmalıdır'
    }
  },

  totalAmount: { type: Number, required: true },

  // Amount paid up front at entry time. Any remainder lives on the linked
  // Creditor (the live source of truth for what's still owed).
  initialPaidAmount: { type: Number, default: 0 },

  // Set when the invoice was not fully paid at entry. Settlement/payment history
  // happen on this Creditor (Kreditorlar bölməsi).
  creditorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Creditor'
  },

  dueDate: { type: Date },
  note: { type: String },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

purchaseInvoiceSchema.index({ ownerId: 1, date: -1 });
purchaseInvoiceSchema.index({ ownerId: 1, vendorId: 1 });

purchaseInvoiceSchema.statics.generateInvoiceNumber = async function() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `FAK-${dateStr}`;
  const sequence = await Counter.next(`pinv:${prefix}`);
  return `${prefix}-${sequence.toString().padStart(4, '0')}`;
};

module.exports = mongoose.model('PurchaseInvoice', purchaseInvoiceSchema);
