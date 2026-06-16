require('dotenv').config();
const mongoose = require('mongoose');
const Debtor = require('../models/Debtor');
const Creditor = require('../models/Creditor');
const Customer = require('../models/Customer');
const Vendor = require('../models/Vendor');
const Sale = require('../models/Sale');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const { DEBT_STATUS } = require('../config/constants');

/**
 * Reconcile debt totals that drifted from the old payment bug (`paidAmount +=
 * "20"` string-concatenation), cancellations, or legacy data.
 *
 * Repair is two-step and deliberately conservative:
 *
 *   1. Repair only ledger records that are actually broken — paidAmount greater
 *      than the total, or a negative remaining (both impossible legitimately).
 *      A credit sale records an UPFRONT payment at creation with no
 *      paymentHistory entry, so a broken record's true paid is recovered as
 *      (upfront from the linked Sale/Invoice) + (Σ paymentHistory, which stays
 *      intact since each payment was cast individually). Healthy records are
 *      left untouched.
 *   2. Rebuild customer.totalDebt / vendor.totalDebt from every record's
 *      (corrected) remaining, fixing aggregate drift even where no record was
 *      broken.
 *
 * Idempotent. Usage:
 *   node utils/reconcileDebts.js --dry    # preview only, no writes
 *   node utils/reconcileDebts.js          # apply
 */
const DRY = process.argv.includes('--dry');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB bağlantısı uğurlu${DRY ? ' (DRY RUN — dəyişiklik yazılmayacaq)' : ''}`);
  } catch (error) {
    console.error('MongoDB bağlantı xətası:', error);
    process.exit(1);
  }
};

const isBroken = (doc, total) =>
  round2(doc.paidAmount) > total + 0.01 || round2(doc.remainingAmount) < -0.01;

// Upfront payment recorded on a debtor at sale time = this owner's share of the
// sale's upfront, proportional to their slice of the sale total.
const debtorUpfront = async (doc, total) => {
  if (!doc.saleId) return 0;
  const sale = await Sale.findById(doc.saleId).select('paidAmount totalAmount').lean();
  if (!sale || !(sale.totalAmount > 0)) return 0;
  return clamp(round2((total * (sale.paidAmount || 0)) / sale.totalAmount), 0, total);
};

// Upfront payment recorded on a creditor at entry time = the invoice's initial paid.
const creditorUpfront = async (doc, total) => {
  if (!doc.purchaseInvoiceId) return 0;
  const inv = await PurchaseInvoice.findById(doc.purchaseInvoiceId).select('initialPaidAmount').lean();
  return inv ? clamp(round2(inv.initialPaidAmount || 0), 0, total) : 0;
};

// Mirror the Debtor/Creditor pre('save') status rule.
const deriveStatus = (paid, remaining, dueDate) => {
  if (remaining <= 0) return DEBT_STATUS.PAID;
  if (paid > 0) return DEBT_STATUS.PARTIAL;
  if (dueDate && new Date() > new Date(dueDate)) return DEBT_STATUS.OVERDUE;
  return DEBT_STATUS.PENDING;
};

const repairAndReconcile = async ({ label, ledgerModel, groupField, deriveUpfront, targetModel, targetLabel }) => {
  const ledgers = await ledgerModel.find({});
  const remainingByEntity = new Map();
  let ledgerFixed = 0;

  // Step 1: repair only broken ledger records.
  for (const doc of ledgers) {
    const total = round2(doc.totalAmount);
    let trueRemaining = round2(doc.remainingAmount);

    if (isBroken(doc, total)) {
      const upfront = await deriveUpfront(doc, total);
      const historySum = (doc.paymentHistory || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const truePaid = clamp(round2(upfront + historySum), 0, total);
      trueRemaining = round2(total - truePaid);

      ledgerFixed += 1;
      console.log(`  ${label} ${doc._id}: ödənilmiş ${round2(doc.paidAmount)} → ${truePaid}, qalıq ${round2(doc.remainingAmount)} → ${trueRemaining}`);
      if (!DRY) {
        // updateOne (not doc.save): save runs schema validation BEFORE the
        // pre('save') hook, so it would reject on the still-corrupted negative
        // remainingAmount. Write the corrected fields + status directly instead.
        const status = deriveStatus(truePaid, trueRemaining, doc.dueDate);
        await ledgerModel.updateOne(
          { _id: doc._id },
          { $set: { paidAmount: truePaid, remainingAmount: trueRemaining, status } }
        );
      }
    }

    const key = String(doc[groupField]);
    remainingByEntity.set(key, round2((remainingByEntity.get(key) || 0) + trueRemaining));
  }
  console.log(`${label}: ${ledgerFixed} pozulmuş qeyd düzəldildi (cəmi ${ledgers.length}).`);

  // Step 2: rebuild the per-entity aggregate from the (corrected) remainders.
  const targets = await targetModel.find({}, '_id totalDebt');
  let targetFixed = 0;
  for (const t of targets) {
    const expected = remainingByEntity.get(String(t._id)) || 0;
    const current = round2(t.totalDebt);
    if (Math.abs(expected - current) > 0.01) {
      targetFixed += 1;
      console.log(`  ${targetLabel} ${t._id}: ${current} → ${expected}`);
      if (!DRY) {
        await targetModel.updateOne({ _id: t._id }, { $set: { totalDebt: expected } });
      }
    }
  }
  console.log(`${targetLabel}: ${targetFixed} sənəd düzəldildi (cəmi ${targets.length}).`);
};

const run = async () => {
  await connectDB();

  console.log('\n--- Debitorlar və müştəri borcları ---');
  await repairAndReconcile({
    label: 'Debitor',
    ledgerModel: Debtor,
    groupField: 'customerId',
    deriveUpfront: debtorUpfront,
    targetModel: Customer,
    targetLabel: 'Müştəri'
  });

  console.log('\n--- Kreditorlar və vendor borcları ---');
  await repairAndReconcile({
    label: 'Kreditor',
    ledgerModel: Creditor,
    groupField: 'vendorId',
    deriveUpfront: creditorUpfront,
    targetModel: Vendor,
    targetLabel: 'Vendor'
  });

  console.log(`\nTamamlandı.${DRY ? ' (DRY RUN)' : ''}`);
  process.exit(0);
};

run();
