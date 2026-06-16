require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB bağlantısı uğurlu');
  } catch (error) {
    console.error('MongoDB bağlantı xətası:', error);
    process.exit(1);
  }
};

const migrateCategories = async () => {
  try {
    await connectDB();

    // Update category codes to match existing products
    const updates = [
      { oldCode: 'elektrik', newCode: 'electric', name: 'Elektrik' },
      { oldCode: 'isidici', newCode: 'heating', name: 'İsidici' },
      { oldCode: 'hamam', newCode: 'bathroom', name: 'Hamam' },
      { oldCode: 'umumi', newCode: 'general', name: 'Ümumi' }
    ];

    for (const update of updates) {
      const result = await Category.updateOne(
        { code: update.oldCode },
        { 
          $set: { 
            code: update.newCode,
            name: update.name,
            isSystem: true
          } 
        }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`✅ Updated: ${update.oldCode} -> ${update.newCode}`);
      } else {
        // Try to create if doesn't exist
        const exists = await Category.findOne({ code: update.newCode });
        if (!exists) {
          await Category.create({
            code: update.newCode,
            name: update.name,
            type: 'product',
            isSystem: true
          });
          console.log(`✅ Created: ${update.newCode}`);
        } else {
          console.log(`ℹ️  Already exists: ${update.newCode}`);
        }
      }
    }

    console.log('✅ Kateqoriya miqrasiyası tamamlandı');
    process.exit(0);
  } catch (error) {
    console.error('❌ Xəta:', error);
    process.exit(1);
  }
};

migrateCategories();
