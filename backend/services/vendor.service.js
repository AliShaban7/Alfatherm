const Vendor = require('../models/Vendor');
const { exactCI } = require('../utils/textMatch');

class VendorService {
  // Outside the Vendors page a vendor is always shown as `companyName || name`
  // (Products, Inventory, Fakturalar, Creditors, New Sale), and both Excel
  // importers resolve the İstehsalçı text against one map keyed by BOTH fields.
  // So neither the representative's name nor the company name may repeat any
  // active vendor's name or company name — otherwise the dropdown shows two
  // identical rows and the importer picks whichever won the map.
  // Vendors are a shared pool (see getAll), so this is store-wide, not per owner.
  // Only active vendors count: a soft-deleted one must not block re-use.
  async assertUniqueIdentity({ name, companyName }, excludeId = null) {
    const base = { isActive: true };
    if (excludeId) base._id = { $ne: excludeId };

    const check = async (value, message) => {
      const trimmed = String(value || '').trim();
      if (!trimmed) return; // companyName optional; both undefined on partial update
      const match = exactCI(trimmed);
      const existing = await Vendor.findOne({
        ...base,
        $or: [{ name: match }, { companyName: match }]
      }).lean();
      if (existing) {
        throw new Error(`${message}: ${existing.companyName || existing.name}`);
      }
    };

    await check(name, 'Bu adda vendor artıq mövcuddur');
    await check(companyName, 'Bu adda şirkət artıq mövcuddur');
  }

  async create(vendorData, ownerId, userId) {
    await this.assertUniqueIdentity({
      name: vendorData.name,
      companyName: vendorData.companyName
    });

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
    // Only check the fields that actually CHANGE. Otherwise a pair of vendors
    // that already share a name (created before this rule existed) could never
    // be edited at all — not even to fix a phone number.
    const current = await Vendor.findById(id).lean();
    if (!current) {
      throw new Error('Vendor tapılmadı');
    }
    const changed = (next, prev) =>
      next !== undefined && String(next || '').trim() !== String(prev || '').trim();

    await this.assertUniqueIdentity(
      {
        name: changed(updateData.name, current.name) ? updateData.name : undefined,
        companyName: changed(updateData.companyName, current.companyName)
          ? updateData.companyName
          : undefined
      },
      id
    );

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
