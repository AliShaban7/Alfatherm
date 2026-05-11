const mongoose = require('mongoose');
const Debtor = require('../models/Debtor');
const Customer = require('../models/Customer');
const { DEBT_STATUS } = require('../config/constants');

class DebtorService {
  async getAll(ownerId, filters = {}) {
    const query = { ownerId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.customerId) {
      query.customerId = filters.customerId;
    }

    if (filters.branchId) {
      query.branchId = filters.branchId;
    }

    if (filters.overdue === 'true') {
      query.status = DEBT_STATUS.OVERDUE;
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const [debtors, total] = await Promise.all([
      Debtor.find(query)
        .populate('customerId', 'name phone type')
        .populate('branchId', 'name code')
        .populate('saleId', 'saleNumber date')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Debtor.countDocuments(query)
    ]);

    return {
      debtors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getById(id, ownerId) {
    const debtor = await Debtor.findOne({ _id: id, ownerId })
      .populate('customerId', 'name phone type address')
      .populate('branchId', 'name code')
      .populate('saleId')
      .populate('paymentHistory.receivedBy', 'name');

    if (!debtor) {
      throw new Error('Debitor tapılmadı');
    }

    return debtor;
  }

  async addPayment(id, paymentData, ownerId, userId) {
    const { amount, paymentMethod, note } = paymentData;

    const debtor = await Debtor.findOne({ _id: id, ownerId });
    if (!debtor) {
      throw new Error('Debitor tapılmadı');
    }

    if (debtor.status === DEBT_STATUS.PAID) {
      throw new Error('Bu borc artıq ödənilib');
    }

    if (amount > debtor.remainingAmount) {
      throw new Error('Ödəniş məbləği qalıq borcdan çox ola bilməz');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      debtor.paymentHistory.push({
        amount,
        paymentMethod,
        date: new Date(),
        receivedBy: userId,
        note
      });

      debtor.paidAmount += amount;
      await debtor.save({ session });

      await Customer.findByIdAndUpdate(
        debtor.customerId,
        { $inc: { totalDebt: -amount } },
        { session }
      );

      await session.commitTransaction();

      return debtor;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getSummary(ownerId, branchId = null) {
    const matchQuery = { ownerId };
    if (branchId) {
      matchQuery.branchId = new mongoose.Types.ObjectId(branchId);
    }

    const summary = await Debtor.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          paidAmount: { $sum: '$paidAmount' },
          remainingAmount: { $sum: '$remainingAmount' }
        }
      }
    ]);

    const totalSummary = await Debtor.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalDebtors: { $sum: 1 },
          totalDebt: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$paidAmount' },
          totalRemaining: { $sum: '$remainingAmount' }
        }
      }
    ]);

    return {
      byStatus: summary,
      total: totalSummary[0] || {
        totalDebtors: 0,
        totalDebt: 0,
        totalPaid: 0,
        totalRemaining: 0
      }
    };
  }

  async getOverdue(ownerId) {
    const now = new Date();
    
    await Debtor.updateMany(
      {
        ownerId,
        status: { $in: [DEBT_STATUS.PENDING, DEBT_STATUS.PARTIAL] },
        dueDate: { $lt: now }
      },
      { status: DEBT_STATUS.OVERDUE }
    );

    return await Debtor.find({
      ownerId,
      status: DEBT_STATUS.OVERDUE
    })
      .populate('customerId', 'name phone')
      .sort({ dueDate: 1 })
      .lean();
  }
}

module.exports = new DebtorService();
