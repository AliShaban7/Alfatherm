/**
 * One-time migration: set Zaur/Ədalət to OWNER, add Anar as SUPER_OWNER admin.
 * Run: node backend/utils/updateRoles.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const connectDB = require('../config/db');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

const run = async () => {
  await connectDB();

  const zaur = await User.findOneAndUpdate(
    { email: 'zaur@alfaterm.az' },
    { role: ROLES.OWNER, name: 'Zaur Müəllim' },
    { new: true }
  );
  const adalat = await User.findOneAndUpdate(
    { email: 'adalat@alfaterm.az' },
    { role: ROLES.OWNER, name: 'Ədalət Müəllim' },
    { new: true }
  );

  let anar = await User.findOne({ email: 'anar@alfaterm.az' });
  if (!anar) {
    const branch = zaur?.branchId || adalat?.branchId;
    anar = await User.create({
      name: 'Anar (Admin)',
      email: 'anar@alfaterm.az',
      phone: '+994500000000',
      password: '123456',
      role: ROLES.SUPER_OWNER,
      ownerId: 'owner_admin_000',
      branchId: branch
    });
    console.log('Created admin: anar@alfaterm.az / 123456');
  } else {
    anar.role = ROLES.SUPER_OWNER;
    anar.ownerId = anar.ownerId || 'owner_admin_000';
    await anar.save();
    console.log('Updated admin: anar@alfaterm.az');
  }

  if (zaur) console.log('Zaur -> OWNER');
  if (adalat) console.log('Ədalət -> OWNER');
  if (!zaur && !adalat) console.log('No zaur/adalat users found — run seed or check emails');

  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
