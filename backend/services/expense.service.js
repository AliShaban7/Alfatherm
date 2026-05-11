const mongoose = require('mongoose');
const Expense = require('../models/Expense');

class ExpenseService {
  async create(expenseData, ownerId, userId) {
    const expense = await Expense.create({
      ...expenseData,
      ownerId,
      createdBy: userId
    });

    return expense;
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

  async getById(id) {
    const expense = await Expense.findById(id)
      .populate('branchId', 'name code')
      .populate('createdBy', 'name');

    if (!expense) {
      throw new Error('Xərc tapılmadı');
    }

    return expense;
  }

  async update(id, updateData, ownerId) {
    const expense = await Expense.findOne({ _id: id, ownerId });

    if (!expense) {
      throw new Error('Xərc tapılmadı');
    }

    Object.assign(expense, updateData);
    await expense.save();

    return expense;
  }

  async delete(id, ownerId) {
    const expense = await Expense.findOneAndDelete({ _id: id, ownerId });

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
      date: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`)
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
