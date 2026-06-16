const Warehouse = require('../models/Warehouse');
const Inventory = require('../models/Inventory');
const { WAREHOUSE_TYPES } = require('../config/constants');

class WarehouseService {
  async create(warehouseData) {
    const existingWarehouse = await Warehouse.findOne({ code: warehouseData.code.toUpperCase() });
    if (existingWarehouse) {
      throw new Error('Bu kod ilə anbar artıq mövcuddur');
    }

    if (warehouseData.type === WAREHOUSE_TYPES.MAIN) {
      const existingMain = await Warehouse.findOne({ type: WAREHOUSE_TYPES.MAIN });
      if (existingMain) {
        throw new Error('Əsas anbar artıq mövcuddur');
      }
    }

    const warehouse = await Warehouse.create({
      ...warehouseData,
      code: warehouseData.code.toUpperCase()
    });

    return warehouse;
  }

  async getAll(filters = {}, canAccessMainWarehouse = false) {
    const query = { isActive: true };

    if (!canAccessMainWarehouse) {
      query.type = WAREHOUSE_TYPES.BRANCH;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.branchId) {
      query.branchId = filters.branchId;
    }

    const warehouses = await Warehouse.find(query)
      .populate('branchId', 'name code')
      .sort({ type: 1, name: 1 })
      .lean();

    return warehouses;
  }

  async getById(id, canAccessMainWarehouse = false) {
    const warehouse = await Warehouse.findById(id)
      .populate('branchId', 'name code address');

    if (!warehouse) {
      throw new Error('Anbar tapılmadı');
    }

    if (warehouse.type === WAREHOUSE_TYPES.MAIN && !canAccessMainWarehouse) {
      throw new Error('Əsas anbara giriş icazəniz yoxdur');
    }

    return warehouse;
  }

  async update(id, updateData, canAccessMainWarehouse = false) {
    const warehouse = await Warehouse.findById(id);

    if (!warehouse) {
      throw new Error('Anbar tapılmadı');
    }

    if (warehouse.type === WAREHOUSE_TYPES.MAIN && !canAccessMainWarehouse) {
      throw new Error('Əsas anbarı redaktə etmə icazəniz yoxdur');
    }

    if (updateData.code) {
      const existingWarehouse = await Warehouse.findOne({ 
        code: updateData.code.toUpperCase(),
        _id: { $ne: id }
      });
      if (existingWarehouse) {
        throw new Error('Bu kod ilə anbar artıq mövcuddur');
      }
      updateData.code = updateData.code.toUpperCase();
    }

    Object.assign(warehouse, updateData);
    await warehouse.save();

    return warehouse;
  }

  async delete(id, canAccessMainWarehouse = false) {
    const warehouse = await Warehouse.findById(id);

    if (!warehouse) {
      throw new Error('Anbar tapılmadı');
    }

    if (warehouse.type === WAREHOUSE_TYPES.MAIN) {
      throw new Error('Əsas anbar silinə bilməz');
    }

    const hasInventory = await Inventory.findOne({ 
      warehouseId: id,
      quantity: { $gt: 0 }
    });

    if (hasInventory) {
      throw new Error('Stoku olan anbar silinə bilməz');
    }

    warehouse.isActive = false;
    await warehouse.save();

    return { message: 'Anbar uğurla silindi' };
  }

  async getMainWarehouse() {
    const mainWarehouse = await Warehouse.findOne({ type: WAREHOUSE_TYPES.MAIN });
    return mainWarehouse;
  }
}

module.exports = new WarehouseService();
