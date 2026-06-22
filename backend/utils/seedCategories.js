require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');

/**
 * Upsert the product category list. Idempotent — run it any time to add new
 * categories or fix a name; existing products keep working because the `code`
 * never changes. Owners can also add/remove categories from the Kateqoriyalar
 * screen (these seeded ones are marked isSystem).
 *
 *   node utils/seedCategories.js
 */
const CATEGORIES = [
  { name: 'Elektrik', code: 'electric' },
  { name: 'İstilik sistemləri', code: 'heating' },
  { name: 'Su təchizatı / Santexnika', code: 'plumbing' },
  { name: 'Hamam və aksesuarlar', code: 'bathroom' },
  { name: 'Kanalizasiya', code: 'sewage' },
  { name: 'Qazanlar / Kombi', code: 'boilers' },
  { name: 'Radiatorlar', code: 'radiators' },
  { name: 'Su qızdırıcıları', code: 'water_heaters' },
  { name: 'Borular və fitinqlər', code: 'pipes_fittings' },
  { name: 'Nasoslar', code: 'pumps' },
  { name: 'Ventilyasiya / Kondisioner', code: 'hvac' },
  { name: 'Alət və avadanlıq', code: 'tools' },
  { name: 'Ümumi', code: 'general' }
];

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
  } catch (error) {
    console.error('MongoDB bağlantı xətası:', error.message);
    process.exit(1);
  }

  for (const c of CATEGORIES) {
    await Category.updateOne(
      { code: c.code, type: 'product' },
      { $set: { name: c.name, type: 'product', isSystem: true } },
      { upsert: true }
    );
    console.log(`  ✓ ${c.name} (${c.code})`);
  }

  console.log(`\n✅ ${CATEGORIES.length} kateqoriya hazırdır.`);
  process.exit(0);
};

run();
