const Vendor = require('../models/Vendor');

class VendorService {
  async create(vendorData, ownerId, userId) {
    const vendor = await Vendor.create({
      ...vendorData,
      ownerId,
      createdBy: userId
    });

    return vendor;
  }

  // Vendors are a shared pool: both owners and the director see and use the same
  // list (ownerId is kept only to record who first added a vendor).
  async getAll(ownerId, filters = {}) {
    const query = { isActive: true };

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { companyName: { $regex: filters.search, $options: 'i' } },
        { country: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const [vendors, total] = await Promise.all([
      Vendor.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Vendor.countDocuments(query)
    ]);

    return {
      vendors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getById(id) {
    const vendor = await Vendor.findById(id);

    if (!vendor) {
      throw new Error('Vendor tapılmadı');
    }

    return vendor;
  }

  async update(id, updateData) {
    const vendor = await Vendor.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!vendor) {
      throw new Error('Vendor tapılmadı');
    }

    return vendor;
  }

  async delete(id) {
    const vendor = await Vendor.findById(id);

    if (!vendor) {
      throw new Error('Vendor tapılmadı');
    }

    if (vendor.totalDebt > 0) {
      throw new Error('Borcu olan vendor silinə bilməz');
    }

    vendor.isActive = false;
    await vendor.save();

    return { message: 'Vendor uğurla silindi' };
  }
}

module.exports = new VendorService();
