const Usta = require('../models/Usta');
const Commission = require('../models/Commission');
const { ROLES, DEBT_STATUS } = require('../config/constants');

class UstaService {
  // Case-insensitive duplicate name guard among active ustas.
  async assertUniqueName(name, excludeId = null) {
    const query = {
      isActive: true,
      name: { $regex: `^${String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    };
    if (excludeId) query._id = { $ne: excludeId };

    const existing = await Usta.findOne(query);
    if (existing) {
      throw new Error('Bu adda usta artıq mövcuddur');
    }
  }

  async create(data, userId) {
    await this.assertUniqueName(data.name);

    return Usta.create({
      name: data.name,
      phone: data.phone,
      note: data.note,
      createdBy: userId
    });
  }

  async getAll(filters = {}) {
    const query = {};
    if (filters.includeInactive !== 'true') {
      query.isActive = true;
    }
    if (filters.search?.trim()) {
      query.name = { $regex: filters.search.trim(), $options: 'i' };
    }

    return Usta.find(query).sort({ name: 1 }).lean();
  }

  async getById(id) {
    const usta = await Usta.findById(id);
    if (!usta) {
      throw new Error('Usta tapılmadı');
    }
    return usta;
  }

  async update(id, data) {
    if (data.name) {
      await this.assertUniqueName(data.name, id);
    }

    // Mongoose 8 strips undefined keys from updates by default, so omitted fields
    // aren't written as null (the old `omitUndefined` option is gone / a no-op).
    const usta = await Usta.findByIdAndUpdate(
      id,
      { name: data.name, phone: data.phone, note: data.note, isActive: data.isActive },
      { new: true, runValidators: true }
    );

    if (!usta) {
      throw new Error('Usta tapılmadı');
    }
    return usta;
  }

  // Soft-delete: keep the record so historical commissions still resolve.
  async delete(id) {
    const usta = await Usta.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!usta) {
      throw new Error('Usta tapılmadı');
    }
    return { message: 'Usta uğurla deaktiv edildi' };
  }

  // Outstanding commission balance per usta. An OWNER sees only what they owe;
  // the SUPER_OWNER (director) sees the full balance across both owners.
  async getBalances(user) {
    const match = { status: { $ne: DEBT_STATUS.PAID } };
    if (user?.role === ROLES.OWNER) {
      match.ownerId = user.ownerId;
    }

    const rows = await Commission.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$ustaId',
          ustaName: { $first: '$ustaName' },
          totalRemaining: { $sum: '$remainingAmount' },
          totalAccrued: { $sum: '$amount' },
          totalPaid: { $sum: '$paidAmount' }
        }
      },
      { $sort: { totalRemaining: -1 } }
    ]);

    return rows.map((r) => ({
      ustaId: r._id,
      ustaName: r.ustaName,
      remaining: r.totalRemaining,
      accrued: r.totalAccrued,
      paid: r.totalPaid
    }));
  }
}

module.exports = new UstaService();
