const mongoose = require('mongoose');
const Salesperson = require('../models/Salesperson');
const Sale = require('../models/Sale');
const Debtor = require('../models/Debtor');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

class SalespersonService {
  // Normalize a bonus rate to a clamped number, or undefined if not provided.
  _rate(v) {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    if (Number.isNaN(n)) return undefined;
    return Math.min(100, Math.max(0, n));
  }

  // Case-insensitive duplicate name guard among active salesmen.
  async assertUniqueName(name, excludeId = null) {
    const query = {
      isActive: true,
      name: { $regex: `^${String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    };
    if (excludeId) query._id = { $ne: excludeId };

    const existing = await Salesperson.findOne(query);
    if (existing) {
      throw new Error('Bu adda satıcı artıq mövcuddur');
    }
  }

  async create(data, userId) {
    await this.assertUniqueName(data.name);

    return Salesperson.create({
      name: data.name,
      phone: data.phone,
      bonusRate: this._rate(data.bonusRate),
      note: data.note,
      createdBy: userId
    });
  }

  async getAll(filters = {}) {
    const query = {};
    // Default to active only; pass includeInactive=true to see everyone.
    if (filters.includeInactive !== 'true') {
      query.isActive = true;
    }
    if (filters.search?.trim()) {
      query.name = { $regex: filters.search.trim(), $options: 'i' };
    }

    return Salesperson.find(query).sort({ name: 1 }).lean();
  }

  async getById(id) {
    const salesperson = await Salesperson.findById(id);
    if (!salesperson) {
      throw new Error('Satıcı tapılmadı');
    }
    return salesperson;
  }

  async update(id, data) {
    if (data.name) {
      await this.assertUniqueName(data.name, id);
    }

    const salesperson = await Salesperson.findByIdAndUpdate(
      id,
      { name: data.name, phone: data.phone, bonusRate: this._rate(data.bonusRate), note: data.note, isActive: data.isActive },
      { new: true, runValidators: true, omitUndefined: true }
    );

    if (!salesperson) {
      throw new Error('Satıcı tapılmadı');
    }
    return salesperson;
  }

  // Soft-delete: keep the record so historical sales still resolve the name.
  async delete(id) {
    const salesperson = await Salesperson.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    if (!salesperson) {
      throw new Error('Satıcı tapılmadı');
    }
    return { message: 'Satıcı uğurla deaktiv edildi' };
  }

  // Personal performance for the logged-in salesperson — based on the sales they
  // entered (Sale.userId). Bonus = the picked salesperson's rate × profit,
  // recognized only on the collected portion of each sale.
  async getMyStats(user, filters = {}) {
    const match = { userId: new mongoose.Types.ObjectId(user._id), status: 'completed' };
    if (filters.startDate || filters.endDate) {
      match.date = {};
      if (filters.startDate) match.date.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const e = new Date(filters.endDate);
        e.setHours(23, 59, 59, 999);
        match.date.$lte = e;
      }
    }

    const rows = await Sale.aggregate([
      { $match: match },
      { $lookup: { from: Debtor.collection.name, localField: '_id', foreignField: 'saleId', as: '_d' } },
      { $addFields: { _paid: { $sum: '$_d.paidAmount' } } },
      {
        $addFields: {
          _frac: {
            $cond: [
              { $eq: ['$paymentType', 'prepaid'] },
              1,
              { $cond: [{ $gt: ['$totalAmount', 0] }, { $min: [1, { $divide: ['$_paid', '$totalAmount'] }] }, 0] }
            ]
          }
        }
      },
      { $lookup: { from: Salesperson.collection.name, localField: 'salespersonId', foreignField: '_id', as: '_sp' } },
      { $addFields: { _rate: { $divide: [{ $ifNull: [{ $first: '$_sp.bonusRate' }, 0] }, 100] } } },
      {
        $group: {
          _id: null,
          salesCount: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          collected: { $sum: { $multiply: ['$totalAmount', '$_frac'] } },
          bonusEarned: { $sum: { $multiply: ['$profit', '$_frac', '$_rate'] } },
          bonusFull: { $sum: { $multiply: ['$profit', '$_rate'] } }
        }
      }
    ]);

    const s = rows[0] || {};
    const totalAmount = round2(s.totalAmount);
    const collected = round2(s.collected);
    return {
      salesCount: s.salesCount || 0,
      totalAmount,
      collected,
      outstanding: round2(totalAmount - collected),
      bonusEarned: round2(s.bonusEarned),
      bonusPending: round2((s.bonusFull || 0) - (s.bonusEarned || 0))
    };
  }

  // Customers this salesperson sold to, with how much debt is still outstanding.
  async getMyCustomers(user) {
    const userId = new mongoose.Types.ObjectId(user._id);
    return Sale.aggregate([
      { $match: { userId, status: 'completed' } },
      { $lookup: { from: Debtor.collection.name, localField: '_id', foreignField: 'saleId', as: '_d' } },
      { $addFields: { _out: { $sum: '$_d.remainingAmount' } } },
      {
        $group: {
          _id: '$customerId',
          salesCount: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          outstanding: { $sum: '$_out' }
        }
      },
      { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: '_c' } },
      {
        $addFields: {
          customerName: { $ifNull: [{ $first: '$_c.name' }, 'Naməlum'] },
          customerPhone: { $first: '$_c.phone' }
        }
      },
      { $project: { _c: 0 } },
      { $sort: { outstanding: -1, totalAmount: -1 } }
    ]);
  }

  _dateMatch(filters = {}) {
    if (!filters.startDate && !filters.endDate) return {};
    const date = {};
    if (filters.startDate) date.$gte = new Date(filters.startDate);
    if (filters.endDate) {
      const e = new Date(filters.endDate);
      e.setHours(23, 59, 59, 999);
      date.$lte = e;
    }
    return { date };
  }

  // Per salesperson-TAG stats (store-wide). Bonus = tag rate × profit, recognized
  // on the collected portion. Visible to salesperson accounts too.
  async getTagStats(filters = {}) {
    const match = { status: 'completed', salespersonId: { $ne: null }, ...this._dateMatch(filters) };

    return Sale.aggregate([
      { $match: match },
      { $lookup: { from: Debtor.collection.name, localField: '_id', foreignField: 'saleId', as: '_d' } },
      { $addFields: { _paid: { $sum: '$_d.paidAmount' } } },
      {
        $addFields: {
          _frac: {
            $cond: [
              { $eq: ['$paymentType', 'prepaid'] },
              1,
              { $cond: [{ $gt: ['$totalAmount', 0] }, { $min: [1, { $divide: ['$_paid', '$totalAmount'] }] }, 0] }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$salespersonId',
          salespersonName: { $first: '$salespersonName' },
          salesCount: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          collected: { $sum: { $multiply: ['$totalAmount', '$_frac'] } },
          recognizedProfit: { $sum: { $multiply: ['$profit', '$_frac'] } },
          fullProfit: { $sum: '$profit' }
        }
      },
      { $lookup: { from: Salesperson.collection.name, localField: '_id', foreignField: '_id', as: '_sp' } },
      { $addFields: { bonusRate: { $ifNull: [{ $first: '$_sp.bonusRate' }, 0] } } },
      {
        $addFields: {
          outstanding: { $round: [{ $subtract: ['$totalAmount', '$collected'] }, 2] },
          bonusEarned: { $round: [{ $multiply: ['$recognizedProfit', { $divide: ['$bonusRate', 100] }] }, 2] },
          bonusPending: { $round: [{ $multiply: [{ $subtract: ['$fullProfit', '$recognizedProfit'] }, { $divide: ['$bonusRate', 100] }] }, 2] }
        }
      },
      { $project: { _sp: 0, recognizedProfit: 0, fullProfit: 0, collected: 0 } },
      { $sort: { totalAmount: -1 } }
    ]);
  }

  // Outstanding debtors on sales made by a given tag (or all tags if id is empty/'all').
  async getTagDebtors(salespersonId, filters = {}) {
    const match = { status: 'completed', ...this._dateMatch(filters) };
    if (salespersonId && salespersonId !== 'all') {
      match.salespersonId = new mongoose.Types.ObjectId(salespersonId);
    } else {
      match.salespersonId = { $ne: null };
    }

    return Sale.aggregate([
      { $match: match },
      { $lookup: { from: Debtor.collection.name, localField: '_id', foreignField: 'saleId', as: '_d' } },
      { $unwind: '$_d' },
      { $match: { '_d.remainingAmount': { $gt: 0 } } },
      { $lookup: { from: 'customers', localField: 'customerId', foreignField: '_id', as: '_c' } },
      {
        $project: {
          _id: '$_d._id',
          saleNumber: 1,
          salespersonName: 1,
          date: 1,
          customerName: { $ifNull: [{ $first: '$_c.name' }, 'Naməlum'] },
          customerPhone: { $first: '$_c.phone' },
          totalAmount: '$_d.totalAmount',
          paidAmount: '$_d.paidAmount',
          remainingAmount: '$_d.remainingAmount'
        }
      },
      { $sort: { remainingAmount: -1 } }
    ]);
  }
}

module.exports = new SalespersonService();
