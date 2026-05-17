/**
 * Updates user roles in existing database without re-seeding.
 * Run: node utils/update-roles.js (from backend folder)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const Branch = require('../models/Branch');
const { ROLES } = require('../config/constants');

async function updateRoles() {
  try {
    await connectDB();

    const branch = await Branch.findOne();
    if (!branch) {
      console.error('No branch found. Run seed.js first.');
      process.exit(1);
    }

    // Super owner: Anar
    let anar = await User.findOne({ email: 'anar@alfaterm.az' });
    if (!anar) {
      anar = await User.create({
        name: 'Anar (Təsisçi)',
        email: 'anar@alfaterm.az',
        phone: '+994500000000',
        password: '123456',
        role: ROLES.SUPER_OWNER,
        ownerId: 'owner_super_anar',
        branchId: branch._id
      });
      console.log('Created super owner: anar@alfaterm.az');
    } else {
      anar.role = ROLES.SUPER_OWNER;
      anar.name = 'Anar (Təsisçi)';
      anar.ownerId = 'owner_super_anar';
      await anar.save();
      console.log('Updated super owner: anar@alfaterm.az');
    }

    const zaur = await User.findOneAndUpdate(
      { email: 'zaur@alfaterm.az' },
      { role: ROLES.OWNER, name: 'Zaur', ownerId: 'owner_zaur_001' },
      { new: true }
    );
    if (zaur) console.log('Updated owner: zaur@alfaterm.az');

    const adalat = await User.findOneAndUpdate(
      { email: 'adalat@alfaterm.az' },
      { role: ROLES.OWNER, name: 'Ədalət', ownerId: 'owner_adalat_002' },
      { new: true }
    );
    if (adalat) console.log('Updated owner: adalat@alfaterm.az');

    console.log('\nRoles updated. Log out and log back in to refresh your session.');
    console.log('Super owner: anar@alfaterm.az / 123456');
    console.log('Owners: zaur@alfaterm.az, adalat@alfaterm.az / 123456');
    process.exit(0);
  } catch (error) {
    console.error('Update error:', error);
    process.exit(1);
  }
}

updateRoles();
