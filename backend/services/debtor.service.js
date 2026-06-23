const mongoose = require('mongoose');
const Debtor = require('../models/Debtor');
const Customer = require('../models/Customer');
const { DEBT_STATUS } = require('../config/constants');

class DebtorService {
  async getAll(ownerFilter = {}, filters = {}) {
    const query = { ...ownerFilter };

    // Director can narrow to one owner's portion (ignored for owners — their
    // ownerFilter already pins them to themselves).
    if (filters.ownerId) {
      query.ownerId = filters.ownerId;
    }

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

  async getById(id, ownerFilter = {}) {
    const debtor = await Debtor.findOne({ _id: id, ...ownerFilter })
      .populate('customerId', 'name phone type address')
      .populate('branchId', 'name code')
      .populate('saleId')
      .populate('paymentHistory.receivedBy', 'name');

    if (!debtor) {
      throw new Error('Debitor tapılmadı');
    }

    return debtor;
  }

  async addPayment(id, paymentData, ownerFilter = {}, userId) {
    const { paymentMethod, note } = paymentData;

    // Coerce the amount to a number. The request body delivers it as a string,
    // and `paidAmount += "20"` would string-concatenate (30 + "20" => "3020"),
    // blowing up the total and driving remainingAmount negative. Round to cents.
    const amount = Math.round((Number(paymentData.amount) || 0) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Düzgün ödəniş məbləği daxil edin');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Concurrency-safe payment. The `remainingAmount >= amount` guard lives in
      // the update filter, and paidAmount/remainingAmount are incremented in the
      // same atomic op, so two simultaneous payments can never both succeed and
      // overpay the debt (the loser's filter no longer matches). A read-then-save
      // would let both pass the check and corrupt the balance.
      const debtor = await Debtor.findOneAndUpdate(
        {
          _id: id,
          ...ownerFilter,
          status: { $ne: DEBT_STATUS.PAID },
          remainingAmount: { $gte: amount - 1e-6 }
        },
        {
          $push: {
            paymentHistory: { amount, paymentMethod, date: new Date(), receivedBy: userId, note }
          },
          $inc: { paidAmount: amount, remainingAmount: -amount }
        },
        { new: true, session }
      );

      if (!debtor) {
        // Disambiguate the failure (not found / already paid / amount too large).
        const existing = await Debtor.findOne({ _id: id, ...ownerFilter })
          .select('status')
          .session(session)
          .lean();
        if (!existing) throw new Error('Debitor tapılmadı');
        if (existing.status === DEBT_STATUS.PAID) throw new Error('Bu borc artıq ödənilib');
        throw new Error('Ödəniş məbləği qalıq borcdan çox ola bilməz');
      }

      // Re-derive remainingAmount/status exactly (the pre-save hook rounds the
      // value and flips pending → partial → paid).
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

  async getSummary(ownerFilter = {}, branchId = null) {
    const matchQuery = { ...ownerFilter };
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

  async getOverdue(ownerFilter = {}) {
    const now = new Date();

    await Debtor.updateMany(
      {
        ...ownerFilter,
        status: { $in: [DEBT_STATUS.PENDING, DEBT_STATUS.PARTIAL] },
        dueDate: { $lt: now }
      },
      { status: DEBT_STATUS.OVERDUE }
    );

    return await Debtor.find({
      ...ownerFilter,
      status: DEBT_STATUS.OVERDUE
    })
      .populate('customerId', 'name phone')
      .sort({ dueDate: 1 })
      .lean();
  }
}

module.exports = new DebtorService();
