require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const { ROLES, WAREHOUSE_TYPES, PRODUCT_CATEGORIES, PRODUCT_UNITS, CUSTOMER_TYPES } = require('../config/constants');

const User = require('../models/User');
const Branch = require('../models/Branch');
const Warehouse = require('../models/Warehouse');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

const seedDatabase = async () => {
  try {
    await connectDB();
    
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Branch.deleteMany({});
    await Warehouse.deleteMany({});
    await Product.deleteMany({});
    await Customer.deleteMany({});

    console.log('Creating branches...');
    const branches = await Branch.create([
      {
        name: 'Baş Ofis',
        code: 'HQ',
        address: 'Bakı, Nəsimi rayonu',
        phone: '+994501234567'
      },
      {
        name: 'Nərimanov Filialı',
        code: 'NRM',
        address: 'Bakı, Nərimanov rayonu',
        phone: '+994502345678'
      },
      {
        name: 'Yasamal Filialı',
        code: 'YSM',
        address: 'Bakı, Yasamal rayonu',
        phone: '+994503456789'
      }
    ]);
    console.log('Branches created:', branches.length);

    console.log('Creating warehouses...');
    const warehouses = await Warehouse.create([
      {
        name: 'Əsas Anbar',
        code: 'WH-MAIN',
        type: WAREHOUSE_TYPES.MAIN,
        address: 'Bakı, Suraxanı rayonu'
      },
      {
        name: 'Baş Ofis Anbarı',
        code: 'WH-HQ',
        type: WAREHOUSE_TYPES.BRANCH,
        branchId: branches[0]._id,
        address: branches[0].address
      },
      {
        name: 'Nərimanov Anbarı',
        code: 'WH-NRM',
        type: WAREHOUSE_TYPES.BRANCH,
        branchId: branches[1]._id,
        address: branches[1].address
      },
      {
        name: 'Yasamal Anbarı',
        code: 'WH-YSM',
        type: WAREHOUSE_TYPES.BRANCH,
        branchId: branches[2]._id,
        address: branches[2].address
      }
    ]);
    console.log('Warehouses created:', warehouses.length);

    console.log('Creating users...');
    const users = await User.create([
      {
        name: 'Anar (Admin)',
        email: 'anar@alfaterm.az',
        phone: '+994500000000',
        password: '123456',
        role: ROLES.SUPER_OWNER,
        ownerId: 'owner_admin_000',
        branchId: branches[0]._id
      },
      {
        name: 'Zaur Müəllim',
        email: 'zaur@alfaterm.az',
        phone: '+994501111111',
        password: '123456',
        role: ROLES.OWNER,
        ownerId: 'owner_zaur_001',
        branchId: branches[0]._id
      },
      {
        name: 'Ədalət Müəllim',
        email: 'adalat@alfaterm.az',
        phone: '+994502222222',
        password: '123456',
        role: ROLES.OWNER,
        ownerId: 'owner_adalat_002',
        branchId: branches[0]._id
      },
      {
        name: 'Satıcı 1',
        email: 'satici1@alfaterm.az',
        phone: '+994503333333',
        password: '123456',
        role: ROLES.EMPLOYEE,
        ownerId: 'owner_zaur_001',  // Shared salespeople — see all owners' data
        branchId: branches[1]._id
      },
      {
        name: 'Satıcı 2',
        email: 'satici2@alfaterm.az',
        phone: '+994504444444',
        password: '123456',
        role: ROLES.EMPLOYEE,
        ownerId: 'owner_zaur_001',  // Shared salespeople — see all owners' data
        branchId: branches[2]._id
      }
    ]);
    console.log('Users created:', users.length);

    console.log('Creating products for Owner Zaur...');
    const zaurProducts = await Product.create([
      {
        name: 'Boiler ARISTON 80L',
        sku: 'BLR-ARS-80',
        brand: 'ARISTON',
        manufacturer: 'Ariston Thermo',
        country: 'İtaliya',
        category: PRODUCT_CATEGORIES.Isidici,
        unit: PRODUCT_UNITS.PIECE,
        costPrice: 350,
        minPrice: 420,
        recommendedPrice: 480,
        ownerId: 'owner_zaur_001',
        createdBy: users[1]._id
      },
      {
        name: 'Radiator Panel 600x1000',
        sku: 'RAD-PNL-6010',
        brand: 'DEMRAD',
        manufacturer: 'Demirdöküm',
        country: 'Türkiyə',
        category: PRODUCT_CATEGORIES.Isidici,
        unit: PRODUCT_UNITS.PIECE,
        costPrice: 85,
        minPrice: 110,
        recommendedPrice: 130,
        ownerId: 'owner_zaur_001',
        createdBy: users[1]._id
      },
      {
        name: 'Kombi BAXI 24kW',
        sku: 'KMB-BXI-24',
        brand: 'BAXI',
        manufacturer: 'BAXI SpA',
        country: 'İtaliya',
        category: PRODUCT_CATEGORIES.Isidici,
        unit: PRODUCT_UNITS.PIECE,
        costPrice: 1200,
        minPrice: 1450,
        recommendedPrice: 1600,
        ownerId: 'owner_zaur_001',
        createdBy: users[1]._id
      }
    ]);
    console.log('Zaur products created:', zaurProducts.length);

    console.log('Creating products for Owner Adalat...');
    const adalatProducts = await Product.create([
      {
        name: 'Elektrik Kabeli 2.5mm NYM',
        sku: 'ELK-NYM-25',
        brand: 'PRYSMIAN',
        manufacturer: 'Prysmian Group',
        country: 'Türkiyə',
        category: PRODUCT_CATEGORIES.ELECTRIC,
        unit: PRODUCT_UNITS.METER,
        costPrice: 1.2,
        minPrice: 1.8,
        recommendedPrice: 2.2,
        ownerId: 'owner_adalat_002',
        createdBy: users[2]._id
      },
      {
        name: 'Rozetka 2-li Schneider',
        sku: 'ELK-ROZ-SCH2',
        brand: 'SCHNEIDER',
        manufacturer: 'Schneider Electric',
        country: 'Fransa',
        category: PRODUCT_CATEGORIES.ELECTRIC,
        unit: PRODUCT_UNITS.PIECE,
        costPrice: 8,
        minPrice: 12,
        recommendedPrice: 15,
        ownerId: 'owner_adalat_002',
        createdBy: users[2]._id
      },
      {
        name: 'Duş Sistemi Grohe',
        sku: 'BTH-DSH-GRH',
        brand: 'GROHE',
        manufacturer: 'Grohe AG',
        country: 'Almaniya',
        category: PRODUCT_CATEGORIES.BATHROOM,
        unit: PRODUCT_UNITS.SET,
        costPrice: 450,
        minPrice: 580,
        recommendedPrice: 650,
        ownerId: 'owner_adalat_002',
        createdBy: users[2]._id
      }
    ]);
    console.log('Adalat products created:', adalatProducts.length);

    console.log('Creating customers...');
    const customers = await Customer.create([
      {
        type: CUSTOMER_TYPES.PHYSICAL,
        name: 'Əli Məmmədov',
        phone: '+994505551111',
        address: 'Bakı, Nəsimi',
        ownerId: 'owner_zaur_001',
        createdBy: users[1]._id
      },
      {
        type: CUSTOMER_TYPES.LEGAL,
        name: 'ABC İnşaat MMC',
        brandName: 'ABC Construction',
        voen: '1234567890',
        phone: '+994125551111',
        contactPerson: 'Rəşad Əliyev',
        address: 'Bakı, Xətai',
        ownerId: 'owner_zaur_001',
        createdBy: users[1]._id
      },
      {
        type: CUSTOMER_TYPES.MASTER,
        name: 'Usta Vüqar',
        phone: '+994556661111',
        address: 'Bakı, Yasamal',
        ownerId: 'owner_zaur_001',
        createdBy: users[1]._id
      },
      {
        type: CUSTOMER_TYPES.PHYSICAL,
        name: 'Leyla Həsənova',
        phone: '+994507771111',
        address: 'Bakı, Binəqədi',
        ownerId: 'owner_adalat_002',
        createdBy: users[2]._id
      },
      {
        type: CUSTOMER_TYPES.LEGAL,
        name: 'XYZ Elektrik MMC',
        brandName: 'XYZ Electric',
        voen: '0987654321',
        phone: '+994127771111',
        contactPerson: 'Kamran Quliyev',
        address: 'Bakı, Sabunçu',
        ownerId: 'owner_adalat_002',
        createdBy: users[2]._id
      }
    ]);
    console.log('Customers created:', customers.length);

    console.log('\n========================================');
    console.log('DATABASE SEEDED SUCCESSFULLY!');
    console.log('========================================');
    console.log('\nTest Users:');
    console.log('----------------------------------------');
    console.log('Admin (full access):');
    console.log('  Email: anar@alfaterm.az');
    console.log('  Password: 123456');
    console.log('----------------------------------------');
    console.log('Owner (Zaur):');
    console.log('  Email: zaur@alfaterm.az');
    console.log('  Password: 123456');
    console.log('  Owner ID: owner_zaur_001');
    console.log('----------------------------------------');
    console.log('Owner (Ədalət):');
    console.log('  Email: adalat@alfaterm.az');
    console.log('  Password: 123456');
    console.log('  Owner ID: owner_adalat_002');
    console.log('----------------------------------------');
    console.log('Employee (Zaur\'s):');
    console.log('  Email: satici1@alfaterm.az');
    console.log('  Password: 123456');
    console.log('----------------------------------------');
    console.log('Employee (Adalat\'s):');
    console.log('  Email: satici2@alfaterm.az');
    console.log('  Password: 123456');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedDatabase();
