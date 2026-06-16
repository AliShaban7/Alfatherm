require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Wipe transactional + catalog data to start the real regime, while KEEPING the
 * setup you need to operate: user accounts, branches, warehouses, categories.
 *
 * Wipes: products, customers, vendors, ustas, salesmen, inventory (stock) and
 * its transactions, sales, debtors, creditors, commissions, purchase invoices,
 * expenses — and resets all numbering counters (sale/SKU/invoice restart at 1).
 *
 * SAFETY: does nothing without the explicit --yes flag. Without it, it only
 * prints how many documents WOULD be deleted (dry run).
 *
 *   node utils/resetData.js          # dry run — shows counts, deletes nothing
 *   node utils/resetData.js --yes    # actually wipe
 *
 * IRREVERSIBLE. Take a database backup first.
 */
const CONFIRM = process.argv.includes('--yes');

// Collections to clear (label + model path).
const TO_WIPE = [
  ['Sale', '../models/Sale'],
  ['Debtor', '../models/Debtor'],
  ['Creditor', '../models/Creditor'],
  ['Commission', '../models/Commission'],
  ['PurchaseInvoice', '../models/PurchaseInvoice'],
  ['InventoryTransaction', '../models/InventoryTransaction'],
  ['Inventory', '../models/Inventory'],
  ['Expense', '../models/Expense'],
  ['Product', '../models/Product'],
  ['Customer', '../models/Customer'],
  ['Vendor', '../models/Vendor'],
  ['Usta', '../models/Usta'],
  ['Salesperson', '../models/Salesperson'],
  ['Counter', '../models/Counter'] // reset numbering sequences
];

// Kept (shown for reassurance; never touched).
const KEPT = [
  ['User', '../models/User'],
  ['Branch', '../models/Branch'],
  ['Warehouse', '../models/Warehouse'],
  ['Category', '../models/Category']
];

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
  } catch (error) {
    console.error('MongoDB bağlantı xətası:', error.message);
    process.exit(1);
  }

  console.log(CONFIRM ? '⚠️  REAL WIPE — silinir...\n' : 'DRY RUN (heç nə silinmir). Silmək üçün: --yes\n');

  console.log('Saxlanılır (toxunulmur):');
  for (const [label, path] of KEPT) {
    try {
      const count = await require(path).countDocuments();
      console.log(`  ${label.padEnd(20)} ${count} sənəd`);
    } catch { /* model may be unused */ }
  }

  console.log('\nSilinir:');
  let totalDeleted = 0;
  for (const [label, path] of TO_WIPE) {
    const Model = require(path);
    const before = await Model.countDocuments();
    if (CONFIRM) {
      const res = await Model.deleteMany({});
      totalDeleted += res.deletedCount || 0;
      console.log(`  ${label.padEnd(20)} ${before} → 0  (${res.deletedCount} silindi)`);
    } else {
      console.log(`  ${label.padEnd(20)} ${before} sənəd silinəcək`);
    }
  }

  console.log(
    CONFIRM
      ? `\n✅ Tamamlandı. Cəmi ${totalDeleted} sənəd silindi. Sistem real iş üçün hazırdır.`
      : '\nDRY RUN bitdi. Təsdiq üçün: node utils/resetData.js --yes'
  );
  process.exit(0);
};

run();
