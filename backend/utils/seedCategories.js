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

const seedCategories = async () => {
  try {
    await connectDB();

    // Check if categories already exist
    const count = await Category.countDocuments();
    if (count > 0) {
      console.log('Kateqoriyalar artıq mövcuddur');
      process.exit(0);
    }

    const categories = [
      {
        name: 'Elektrik',
        code: 'electric',
        type: 'product',
        isSystem: true
      },
      {
        name: 'İsidici',
        code: 'heating',
        type: 'product',
        isSystem: true
      },
      {
        name: 'Hamam',
        code: 'bathroom',
        type: 'product',
        isSystem: true
      },
      {
        name: 'Ümumi',
        code: 'general',
        type: 'product',
        isSystem: true
      }
    ];

    await Category.insertMany(categories);
    console.log('✅ Kateqoriyalar uğurla əlavə edildi');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Xəta:', error);
    process.exit(1);
  }
};

seedCategories();
