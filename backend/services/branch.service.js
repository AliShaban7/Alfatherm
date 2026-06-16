const Branch = require('../models/Branch');
const Warehouse = require('../models/Warehouse');
const { WAREHOUSE_TYPES } = require('../config/constants');

class BranchService {
  async create(branchData) {
    const existingBranch = await Branch.findOne({ code: branchData.code.toUpperCase() });
    if (existingBranch) {
      throw new Error('Bu kod ilə filial artıq mövcuddur');
    }

    const branch = await Branch.create({
      ...branchData,
      code: branchData.code.toUpperCase()
    });

    await Warehouse.create({
      name: `${branch.name} Anbarı`,
      code: `WH-${branch.code}`,
      type: WAREHOUSE_TYPES.BRANCH,
      branchId: branch._id,
      address: branch.address
    });

    return branch;
  }

  async getAll(filters = {}) {
    const query = { isActive: true };

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { code: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const branches = await Branch.find(query)
      .populate('managerId', 'name email')
      .sort({ name: 1 })
      .lean();

    return branches;
  }

  async getById(id) {
    const branch = await Branch.findById(id)
      .populate('managerId', 'name email phone');

    if (!branch) {
      throw new Error('Filial tapılmadı');
    }

    const warehouse = await Warehouse.findOne({ branchId: id });

    return {
      ...branch.toObject(),
      warehouse
    };
  }

  async update(id, updateData) {
    if (updateData.code) {
      const existingBranch = await Branch.findOne({ 
        code: updateData.code.toUpperCase(),
        _id: { $ne: id }
      });
      if (existingBranch) {
        throw new Error('Bu kod ilə filial artıq mövcuddur');
      }
      updateData.code = updateData.code.toUpperCase();
    }

    const branch = await Branch.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!branch) {
      throw new Error('Filial tapılmadı');
    }

    return branch;
  }

  async delete(id) {
    const branch = await Branch.findById(id);

    if (!branch) {
      throw new Error('Filial tapılmadı');
    }

    branch.isActive = false;
    await branch.save();

    return { message: 'Filial uğurla silindi' };
  }
}

module.exports = new BranchService();
