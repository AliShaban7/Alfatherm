require('dotenv').config();
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');

/**
 * Backfill per-item ownership on existing sales.
 *
 * Older sales were created before products from multiple owners could be
 * attributed individually. They lack `items.productOwnerId` and the top-level
 * `ownerIds` array, which means a founder's reports/lists would no longer find
 * them. This script reconstructs both from each line item's product (falling
 * back to the sale's own ownerId when the product is missing).
 *
 * Idempotent: re-running only touches sales still missing the fields.
 */
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB bağlantısı uğurlu');
  } catch (error) {
    console.error('MongoDB bağlantı xətası:', error);
    process.exit(1);
  }
};

const migrateSaleOwners = async () => {
  try {
    await connectDB();

    // Cache product -> ownerId so we don't query the same product repeatedly.
    const productOwnerCache = new Map();
    const resolveOwner = async (productId, fallbackOwnerId) => {
      const key = String(productId);
      if (productOwnerCache.has(key)) return productOwnerCache.get(key);
      const product = await Product.findById(productId).select('ownerId').lean();
      const ownerId = product?.ownerId || fallbackOwnerId;
      productOwnerCache.set(key, ownerId);
      return ownerId;
    };

    // Any sale where an item is missing productOwnerId, or ownerIds is absent.
    const cursor = Sale.find({
      $or: [
        { ownerIds: { $exists: false } },
        { ownerIds: { $size: 0 } },
        { 'items.productOwnerId': { $exists: false } }
      ]
    }).cursor();

    let scanned = 0;
    let updated = 0;

    for (let sale = await cursor.next(); sale != null; sale = await cursor.next()) {
      scanned += 1;
      const ownerSet = new Set();

      for (const item of sale.items) {
        if (!item.productOwnerId) {
          item.productOwnerId = await resolveOwner(item.productId, sale.ownerId);
        }
        ownerSet.add(item.productOwnerId);
      }

      sale.ownerIds = [...ownerSet];
      await sale.save();
      updated += 1;

      if (updated % 100 === 0) {
        console.log(`... ${updated} satış yeniləndi`);
      }
    }

    console.log(`✅ Tamamlandı. Yoxlanıldı: ${scanned}, yeniləndi: ${updated}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Xəta:', error);
    process.exit(1);
  }
};

migrateSaleOwners();
