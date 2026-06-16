const mongoose = require('mongoose');
const Creditor = require('../models/Creditor');
const Vendor = require('../models/Vendor');
const { DEBT_STATUS } = require('../config/constants');

class CreditorService {
  async create(creditorData, ownerId, userId) {
    const { vendorId, description, dueDate, note } = creditorData;

    // Coerce the debt amount (body sends a string) and require it to be positive,
    // so a string/negative can't corrupt the creditor or vendor.totalDebt.
    const totalAmount = Math.round((Number(creditorData.totalAmount) || 0) * 100) / 100;
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new Error('Düzgün borc məbləği daxil edin');
    }

    const vendor = await Vendor.findOne({ _id: vendorId, ownerId });
    if (!vendor) {
      throw new Error('Vendor tapılmadı');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const creditor = await Creditor.create([{
        ownerId,
        vendorId,
        description,
        totalAmount,
        paidAmount: 0,
        remainingAmount: totalAmount,
        dueDate,
        note,
        createdBy: userId
      }], { session });

      await Vendor.findByIdAndUpdate(
        vendorId,
        { $inc: { totalDebt: totalAmount } },
        { session }
      );

      await session.commitTransaction();

      return creditor[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getAll(ownerFilter = {}, filters = {}) {
    const query = { ...ownerFilter };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.vendorId) {
      query.vendorId = filters.vendorId;
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const [creditors, total] = await Promise.all([
      Creditor.find(query)
        .populate('vendorId', 'name companyName phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Creditor.countDocuments(query)
    ]);

    return {
      creditors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getById(id, ownerFilter = {}) {
    const creditor = await Creditor.findOne({ _id: id, ...ownerFilter })
      .populate('vendorId', 'name companyName phone address')
      .populate('paymentHistory.paidBy', 'name');

    if (!creditor) {
      throw new Error('Kreditor tapılmadı');
    }

    return creditor;
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

    const creditor = await Creditor.findOne({ _id: id, ...ownerFilter });
    if (!creditor) {
      throw new Error('Kreditor tapılmadı');
    }

    if (creditor.status === DEBT_STATUS.PAID) {
      throw new Error('Bu borc artıq ödənilib');
    }

    if (amount > creditor.remainingAmount + 1e-6) {
      throw new Error('Ödəniş məbləği qalıq borcdan çox ola bilməz');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      creditor.paymentHistory.push({
        amount,
        paymentMethod,
        date: new Date(),
        paidBy: userId,
        note
      });

      creditor.paidAmount += amount;
      await creditor.save({ session });

      await Vendor.findByIdAndUpdate(
        creditor.vendorId,
        { $inc: { totalDebt: -amount } },
        { session }
      );

      await session.commitTransaction();

      return creditor;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getSummary(ownerFilter = {}) {
    const summary = await Creditor.aggregate([
      { $match: { ...ownerFilter } },
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

    const totalSummary = await Creditor.aggregate([
      { $match: { ...ownerFilter } },
      {
        $group: {
          _id: null,
          totalCreditors: { $sum: 1 },
          totalDebt: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$paidAmount' },
          totalRemaining: { $sum: '$remainingAmount' }
        }
      }
    ]);

    return {
      byStatus: summary,
      total: totalSummary[0] || {
        totalCreditors: 0,
        totalDebt: 0,
        totalPaid: 0,
        totalRemaining: 0
      }
    };
  }
}

module.exports = new CreditorService();
