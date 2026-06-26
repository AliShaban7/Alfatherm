/**
 * One-time migration: reassign every product (and its stock) owned by the store
 * (owner_admin_000) to a founder. Products belong to founders — there is no
 * "Mağaza" owner — so store-owned products were an artifact of salesperson-created
 * products being filed under the store namespace.
 *
 * Target founder is Ədalət (owner_adalat_002). Historical sales/debtors/expenses
 * are left untouched (they record what happened at the time); only the products'
 * current ownership and their live inventory rows are moved.
 *
 * Run:  node backend/utils/reassignStoreProducts.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const { OWNER_IDS } = require('../config/constants');

const FROM = OWNER_IDS.ADMIN;   // owner_admin_000 (store)
const TO = OWNER_IDS.ADALAT;    // owner_adalat_002 (Ədalət)

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI not set');
  await mongoose.connect(uri);

  const before = await Product.countDocuments({ ownerId: FROM });
  const p = await Product.updateMany({ ownerId: FROM }, { $set: { ownerId: TO } });
  const i = await Inventory.updateMany({ ownerId: FROM }, { $set: { ownerId: TO } });

  console.log(`Store-owned products found: ${before}`);
  console.log(`Products reassigned to ${TO}: ${p.modifiedCount}`);
  console.log(`Inventory rows reassigned to ${TO}: ${i.modifiedCount}`);

  await mongoose.disconnect();
  console.log('Done.');
})().catch((e) => { console.error(e); process.exit(1); });
