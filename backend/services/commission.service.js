const mongoose = require('mongoose');
const Commission = require('../models/Commission');
const { DEBT_STATUS } = require('../config/constants');

class CommissionService {
  // Pay down an usta's outstanding commission for one owner. The payment is a
  // cash settlement that reduces the balance — it is NOT a P&L expense, since
  // the commission cost was already booked at the sale (accrual). Applies the
  // amount across the owner's open commission records oldest-first (FIFO).
  async payUsta(ustaId, ownerId, amount, paymentMethod, userId, note) {
    const pay = Number(amount);
    if (!ownerId) {
      throw new Error('Owner seçilməyib');
    }
    if (!(pay > 0)) {
      throw new Error('Ödəniş məbləği müsbət olmalıdır');
    }

    const open = await Commission.find({
      ustaId,
      ownerId,
      status: { $ne: DEBT_STATUS.PAID }
    }).sort({ date: 1, _id: 1 });

    const outstanding = open.reduce((sum, c) => sum + c.remainingAmount, 0);
    if (pay > outstanding + 1e-6) {
      throw new Error(`Ödəniş qalıq balansdan (${outstanding.toFixed(2)} AZN) çox ola bilməz`);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      let left = pay;
      for (const commission of open) {
        if (left <= 1e-6) break;

        const applied = Math.min(commission.remainingAmount, left);
        if (applied <= 0) continue;

        commission.paidAmount += applied;
        commission.paymentHistory.push({
          amount: applied,
          paymentMethod: paymentMethod || 'cash',
          paidBy: userId,
          note
        });
        await commission.save({ session }); // pre('save') recomputes remaining/status
        left -= applied;
      }

      await session.commitTransaction();
      return { paid: pay, remaining: outstanding - pay };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new CommissionService();
