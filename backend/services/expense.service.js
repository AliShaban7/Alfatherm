const mongoose = require('mongoose');
const Expense = require('../models/Expense');

class ExpenseService {
  async create(expenseData, ownerId, userId) {
    const { ownerSplit, isShared, ...rest } = expenseData;

    // Split between owners: create one expense per owner with their share, so
    // each owner's Profit/Loss reflects exactly their portion (not the full
    // amount, which the old `isShared` flag double-counted across owners).
    if (Array.isArray(ownerSplit) && ownerSplit.length > 0) {
      const shares = ownerSplit
        .map((s) => ({ ownerId: s.ownerId, amount: Math.round((Number(s.amount) || 0) * 100) / 100 }))
        .filter((s) => s.ownerId && s.amount > 0);

      if (shares.length === 0) {
        throw new Error('Bölüşdürmə məbləğlərini daxil edin');
      }

      const splitTotal = shares.reduce((sum, s) => sum + s.amount, 0);
      const expenseTotal = Number(rest.amount) || 0;
      if (Math.abs(splitTotal - expenseTotal) > 0.01) {
        throw new Error('Bölüşdürmə cəmi xərc məbləğinə bərabər olmalıdır');
      }

      const docs = shares.map((s) => ({
        ...rest,
        amount: s.amount,
        ownerId: s.ownerId,
        isShared: false,
        createdBy: userId
      }));

      // Array form still triggers the per-doc pre('save') (expenseNumber). Fine
      // here — manual expenses are low volume (a couple of docs at a time).
      return Expense.create(docs);
    }

    // Single-owner expense (no split): keep the legacy behavior.
    return Expense.create({
      ...rest,
      ownerId,
      isShared: !!isShared,
      createdBy: userId
    });
  }

  async getAll(ownerId, filters = {}) {
    const query = {};

    if (ownerId) {
      query.$or = [
        { ownerId },
        { isShared: true }
      ];
    }

    if (filters.branchId) {
      query.branchId = filters.branchId;
    }

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.startDate || filters.endDate) {
      query.date = {};
      if (filters.startDate) {
        query.date.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.date.$lte = new Date(filters.endDate);
      }
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .populate('branchId', 'name code')
        .populate('createdBy', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Expense.countDocuments(query)
    ]);

    return {
      expenses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getById(id, ownerId) {
    // Scope to the requester's own (or shared) expenses. A founder must not be
    // able to read the other founder's expense by guessing its id; the director
    // passes ownerId = null and sees everything.
    const query = { _id: id };
    if (ownerId) {
      query.$or = [{ ownerId }, { isShared: true }];
    }

    const expense = await Expense.findOne(query)
      .populate('branchId', 'name code')
      .populate('createdBy', 'name');

    if (!expense) {
      throw new Error('Xərc tapılmadı');
    }

    return expense;
  }

  async update(id, updateData, ownerId) {
    // A founder may only edit their own expenses; the director (ownerId = null)
    // may edit any. ownerId is never overwritten from the body.
    const { ownerId: _ignore, ...safeUpdate } = updateData;
    const query = ownerId ? { _id: id, ownerId } : { _id: id };
    const expense = await Expense.findOne(query);

    if (!expense) {
      throw new Error('Xərc tapılmadı');
    }

    Object.assign(expense, safeUpdate);
    await expense.save();

    return expense;
  }

  async delete(id, ownerId) {
    const query = ownerId ? { _id: id, ownerId } : { _id: id };
    const expense = await Expense.findOneAndDelete(query);

    if (!expense) {
      throw new Error('Xərc tapılmadı');
    }

    return { message: 'Xərc uğurla silindi' };
  }

  async getSummaryByCategory(ownerId, branchId, startDate, endDate) {
    const matchQuery = {};

    if (ownerId) {
      matchQuery.$or = [
        { ownerId },
        { isShared: true }
      ];
    }

    if (branchId) {
      matchQuery.branchId = new mongoose.Types.ObjectId(branchId);
    }

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) {
        matchQuery.date.$gte = new Date(startDate);
      }
      if (endDate) {
        matchQuery.date.$lte = new Date(endDate);
      }
    }

    const summary = await Expense.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    const total = summary.reduce((sum, cat) => sum + cat.totalAmount, 0);

    return {
      byCategory: summary,
      total
    };
  }

  async getMonthlySummary(ownerId, branchId, year) {
    const matchQuery = {
      // Half-open range [Jan 1, next Jan 1). `$lte: ${year}-12-31` resolves to
      // midnight Dec 31, dropping every expense recorded later that day.
      date: {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${Number(year) + 1}-01-01`)
      }
    };

    if (ownerId) {
      matchQuery.$or = [
        { ownerId },
        { isShared: true }
      ];
    }

    if (branchId) {
      matchQuery.branchId = new mongoose.Types.ObjectId(branchId);
    }

    const summary = await Expense.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $month: '$date' },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      totalAmount: 0,
      count: 0
    }));

    summary.forEach(item => {
      months[item._id - 1] = {
        month: item._id,
        totalAmount: item.totalAmount,
        count: item.count
      };
    });

    return months;
  }
}

module.exports = new ExpenseService();
