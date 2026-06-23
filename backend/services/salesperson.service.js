const Salesperson = require('../models/Salesperson');

class SalespersonService {
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

    // Mongoose 8 strips undefined keys from updates by default, so fields the
    // caller omitted aren't written as null (the old `omitUndefined` option is
    // gone and was a no-op here).
    const salesperson = await Salesperson.findByIdAndUpdate(
      id,
      { name: data.name, phone: data.phone, note: data.note, isActive: data.isActive },
      { new: true, runValidators: true }
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
}

module.exports = new SalespersonService();
