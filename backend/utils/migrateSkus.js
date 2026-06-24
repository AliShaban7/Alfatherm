require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Counter = require('../models/Counter');

/**
 * Renumber every existing product's SKU into the short single-letter format
 * (Z-0001 / A-0001 / S-0001). `sku` is globally unique, so this runs in two
 * passes — first park each SKU at a unique temp value, then assign the final
 * per-owner sequence — to avoid hitting the unique index mid-update. Counters
 * are set so newly-created products continue the sequence. Idempotent.
 *
 * SKUs aren't referenced by id anywhere (sales/inventory link by productId), so
 * rewriting them is safe.
 */
const pad = (n) => String(n).padStart(4, '0');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB bağlantısı uğurlu');

    // Pass 1: temp, collision-free SKUs.
    const all = await Product.find({}).select('_id').lean();
    if (all.length) {
      await Product.bulkWrite(all.map((p) => ({
        updateOne: { filter: { _id: p._id }, update: { $set: { sku: `TMP-${p._id}` } } }
      })));
    }
    console.log(`Pass 1: ${all.length} məhsul müvəqqəti SKU-ya keçirildi`);

    // Pass 2: per owner, renumber by creation order with the short prefix.
    const ownerIds = await Product.distinct('ownerId');
    let total = 0;
    for (const ownerId of ownerIds) {
      const letter = Product.skuLetter(ownerId);
      const docs = await Product.find({ ownerId }).sort({ createdAt: 1, _id: 1 }).select('_id').lean();
      if (docs.length) {
        await Product.bulkWrite(docs.map((d, i) => ({
          updateOne: { filter: { _id: d._id }, update: { $set: { sku: `${letter}-${pad(i + 1)}` } } }
        })));
      }
      await Counter.findByIdAndUpdate(`sku:${letter}`, { $set: { seq: docs.length } }, { upsert: true });
      total += docs.length;
      console.log(`  ${ownerId} (${letter}): ${docs.length} → ${letter}-0001..${letter}-${pad(docs.length)}`);
    }

    console.log(`Tamamlandı: ${total} məhsulun SKU-su yeniləndi`);
  } catch (error) {
    console.error('Miqrasiya xətası:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
