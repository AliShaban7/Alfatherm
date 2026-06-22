require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');

/**
 * One-time backfill: link existing products to a vendor by id, using the vendor
 * NAME previously stored in the product's `manufacturer` (İstehsalçı) field.
 * Products that already have a vendorId, or whose manufacturer doesn't match any
 * vendor name, are left untouched (and reported).
 *
 *   node utils/backfillProductVendor.js          # dry run (no writes)
 *   node utils/backfillProductVendor.js --yes     # apply
 */
const CONFIRM = process.argv.includes('--yes');
const norm = (s) => String(s || '').trim().toLowerCase();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
  } catch (error) {
    console.error('MongoDB bağlantı xətası:', error.message);
    process.exit(1);
  }
  console.log(CONFIRM ? 'Tətbiq olunur...\n' : 'DRY RUN (dəyişiklik yazılmayacaq)\n');

  const vendors = await Vendor.find({}, '_id name').lean();
  const byName = new Map(vendors.map((v) => [norm(v.name), v._id]));

  const products = await Product.find({ vendorId: { $in: [null, undefined] } }, '_id name manufacturer').lean();
  let matched = 0;
  const unmatched = [];

  for (const p of products) {
    const vendorId = byName.get(norm(p.manufacturer));
    if (vendorId) {
      matched += 1;
      console.log(`  ${p.name}: İstehsalçı "${p.manufacturer}" → vendor ${vendorId}`);
      if (CONFIRM) {
        await Product.updateOne({ _id: p._id }, { $set: { vendorId } });
      }
    } else if (p.manufacturer) {
      unmatched.push(`${p.name} (İstehsalçı: "${p.manufacturer}")`);
    }
  }

  console.log(`\n${matched} məhsul vendora bağlandı.`);
  if (unmatched.length) {
    console.log(`\nVendor tapılmayan ${unmatched.length} məhsul (Vendorlar-da əlavə edin və ya məhsulu redaktə edin):`);
    unmatched.forEach((u) => console.log(`  - ${u}`));
  }
  console.log(CONFIRM ? '\n✅ Tamamlandı.' : '\nDRY RUN bitdi. Tətbiq üçün: --yes');
  process.exit(0);
};

run();
