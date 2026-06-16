require('dotenv').config();
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Debtor = require('../models/Debtor');
const Customer = require('../models/Customer');
const InventoryTransaction = require('../models/InventoryTransaction');
const inventoryService = require('../services/inventory.service');

/**
 * Repair sales that were cancelled BEFORE cancel() restored stock / reversed
 * debt. For each cancelled sale with no RETURN transaction, this returns each
 * line's stock to its warehouse, removes the sale's debtors, and rolls back the
 * customer's totals.
 *
 * Idempotent: a sale that already has a RETURN transaction is skipped, so it's
 * safe to run more than once.
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

const repair = async () => {
  await connectDB();

  const cancelledSales = await Sale.find({ status: 'cancelled' });
  let repaired = 0;
  let skipped = 0;

  for (const sale of cancelledSales) {
    const alreadyRestored = await InventoryTransaction.exists({ saleId: sale._id, type: 'RETURN' });
    if (alreadyRestored) {
      skipped += 1;
      continue;
    }

    // Non-transactional, sequential writes. A one-off repair doesn't need the
    // concurrency guarantees of a transaction, and this environment's txn layer
    // throws transient "catalog changes" errors. Order: restore stock first
    // (RETURN txn is the idempotency marker), then debt, then customer totals.
    try {
      for (const item of sale.items) {
        await inventoryService.restoreForSale(
          item.productId,
          sale.warehouseId,
          item.quantity,
          sale._id,
          item.productOwnerId || sale.ownerId,
          sale.userId,
          undefined
        );
      }

      const debtors = await Debtor.find({ saleId: sale._id });
      const outstandingDebt = debtors.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
      if (debtors.length) {
        await Debtor.deleteMany({ saleId: sale._id });
      }

      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { totalPurchases: -sale.totalAmount, totalDebt: -outstandingDebt }
      });

      repaired += 1;
      console.log(`✅ Bərpa edildi: ${sale.saleNumber}`);
    } catch (error) {
      console.error(`❌ ${sale.saleNumber}: ${error.message}`);
    }
  }

  console.log(`\nTamamlandı. Bərpa: ${repaired}, atlanıldı (artıq bərpalı): ${skipped}`);
  process.exit(0);
};

repair();
