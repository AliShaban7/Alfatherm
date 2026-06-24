const Warehouse = require('../models/Warehouse');
const Inventory = require('../models/Inventory');
const Branch = require('../models/Branch');
const Counter = require('../models/Counter');
const { WAREHOUSE_TYPES } = require('../config/constants');

class WarehouseService {
  // Next free code of the form PREFIX-NNN, skipping any already taken.
  async _generateCode(Model, prefix) {
    let code;
    do {
      const seq = await Counter.next(`code:${prefix}`);
      code = `${prefix}-${String(seq).padStart(3, '0')}`;
    } while (await Model.exists({ code }));
    return code;
  }

  async create(warehouseData) {
    const data = { ...warehouseData };

    // Auto-generate the code if none was supplied: stores get ST-, storage WH-.
    const prefix = data.isStore ? 'ST' : 'WH';
    data.code = data.code ? data.code.toUpperCase() : await this._generateCode(Warehouse, prefix);

    if (await Warehouse.findOne({ code: data.code })) {
      throw new Error('Bu kod ilə anbar artıq mövcuddur');
    }

    if (data.type === WAREHOUSE_TYPES.MAIN) {
      if (await Warehouse.findOne({ type: WAREHOUSE_TYPES.MAIN })) {
        throw new Error('Əsas anbar artıq mövcuddur');
      }
    } else {
      // Branch warehouses need a branch. There's no separate Branches screen, so
      // if one wasn't chosen, create a matching branch automatically (1:1 with
      // the warehouse) — the model requires it for sales/reporting.
      if (!data.branchId) {
        const branch = await Branch.create({
          name: data.name,
          code: await this._generateCode(Branch, 'BR'),
          address: data.address || data.name
        });
        data.branchId = branch._id;
      }
    }

    return Warehouse.create(data);
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

    // No branch populate: the list/selectors never show the branch, so skip the
    // extra lookup. Sort stores first, then by name.
    const warehouses = await Warehouse.find(query)
      .sort({ isStore: -1, name: 1 })
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
