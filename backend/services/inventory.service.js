const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const Vendor = require('../models/Vendor');
const Creditor = require('../models/Creditor');
const { INVENTORY_TRANSACTION_TYPES, WAREHOUSE_TYPES, ROLES } = require('../config/constants');

class InventoryService {
  async productEntry(data, ownerId, userId, canAccessMainWarehouse) {
    const { productId, warehouseId, quantity, costPrice, note, vendorId, paymentStatus, paidAmount, dueDate } = data;

    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) {
      throw new Error('Anbar tapılmadı');
    }

    if (warehouse.type === WAREHOUSE_TYPES.MAIN && !canAccessMainWarehouse) {
      throw new Error('Əsas anbara giriş icazəniz yoxdur');
    }

    const product = await Product.findOne({ _id: productId, ownerId });
    if (!product) {
      throw new Error('Məhsul tapılmadı');
    }

    if (!vendorId) {
      throw new Error('Vendor seçin');
    }

    const vendor = await Vendor.findOne({ _id: vendorId, ownerId });
    if (!vendor) {
      throw new Error('Vendor tapılmadı');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let inventory = await Inventory.findOne({ productId, warehouseId, ownerId });
      const entryCostPrice = costPrice || product.costPrice || 0;
      const totalAmount = quantity * entryCostPrice;
      const paid = paymentStatus === 'paid' ? totalAmount : (paidAmount || 0);

      if (inventory) {
        const oldTotal = inventory.quantity * (inventory.costPrice || 0);
        const newTotal = quantity * entryCostPrice;
        const newQuantity = inventory.quantity + quantity;
        inventory.costPrice = newQuantity > 0 ? (oldTotal + newTotal) / newQuantity : entryCostPrice;
        inventory.quantity = newQuantity;
        inventory.lastUpdated = new Date();
        await inventory.save({ session });
      } else {
        inventory = await Inventory.create([{
          productId,
          warehouseId,
          ownerId,
          quantity,
          costPrice: entryCostPrice
        }], { session });
        inventory = inventory[0];
      }

      let creditor = null;
      if (paymentStatus !== 'paid') {
        creditor = await Creditor.create([{
          ownerId,
          vendorId,
          description: `Mal girişi - ${product.name} (${quantity} ${product.unit})`,
          totalAmount,
          paidAmount: paid,
          remainingAmount: totalAmount - paid,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          createdBy: userId
        }], { session });
        creditor = creditor[0];

        vendor.totalDebt = (vendor.totalDebt || 0) + (totalAmount - paid);
        await vendor.save({ session });
      }

      const transaction = await InventoryTransaction.create([{
        type: INVENTORY_TRANSACTION_TYPES.IN,
        productId,
        ownerId,
        toWarehouseId: warehouseId,
        quantity,
        costPrice: entryCostPrice,
        vendorId,
        creditorId: creditor ? creditor._id : null,
        note,
        createdBy: userId
      }], { session });

      await session.commitTransaction();

      return {
        inventory,
        transaction: transaction[0],
        creditor
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async transfer(data, ownerId, userId, canAccessMainWarehouse, user = null) {
    const { productId, fromWarehouseId, toWarehouseId, quantity, note } = data;

    const [fromWarehouse, toWarehouse] = await Promise.all([
      Warehouse.findById(fromWarehouseId),
      Warehouse.findById(toWarehouseId)
    ]);

    if (!fromWarehouse || !toWarehouse) {
      throw new Error('Anbar tapılmadı');
    }

    if ((fromWarehouse.type === WAREHOUSE_TYPES.MAIN || toWarehouse.type === WAREHOUSE_TYPES.MAIN)
        && !canAccessMainWarehouse) {
      throw new Error('Əsas anbara giriş icazəniz yoxdur');
    }

    // Super owner (director) may move any owner's stock; founders only their own.
    const productScope = user?.role === ROLES.SUPER_OWNER
      ? { _id: productId }
      : { _id: productId, ownerId };
    const product = await Product.findOne(productScope);
    if (!product) {
      throw new Error('Məhsul tapılmadı');
    }
    // All stock rows for this transfer belong to the product's owner.
    ownerId = product.ownerId;

    const fromInventory = await Inventory.findOne({
      productId,
      warehouseId: fromWarehouseId,
      ownerId
    });

    if (!fromInventory || fromInventory.quantity < quantity) {
      throw new Error('Kifayət qədər stok yoxdur');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      fromInventory.quantity -= quantity;
      fromInventory.lastUpdated = new Date();
      await fromInventory.save({ session });

      let toInventory = await Inventory.findOne({ 
        productId, 
        warehouseId: toWarehouseId, 
        ownerId 
      });

      const transferCostPrice = fromInventory.costPrice || 0;
      
      if (toInventory) {
        const oldTotal = toInventory.quantity * (toInventory.costPrice || 0);
        const newTotal = quantity * transferCostPrice;
        const newQuantity = toInventory.quantity + quantity;
        toInventory.costPrice = newQuantity > 0 ? (oldTotal + newTotal) / newQuantity : transferCostPrice;
        toInventory.quantity = newQuantity;
        toInventory.lastUpdated = new Date();
        await toInventory.save({ session });
      } else {
        toInventory = await Inventory.create([{
          productId,
          warehouseId: toWarehouseId,
          ownerId,
          quantity,
          costPrice: transferCostPrice
        }], { session });
        toInventory = toInventory[0];
      }

      const transaction = await InventoryTransaction.create([{
        type: INVENTORY_TRANSACTION_TYPES.TRANSFER,
        productId,
        ownerId,
        fromWarehouseId,
        toWarehouseId,
        quantity,
        note,
        createdBy: userId
      }], { session });

      await session.commitTransaction();

      return {
        fromInventory,
        toInventory,
        transaction: transaction[0]
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async deductForSale(productId, warehouseId, quantity, salePrice, saleId, ownerId, userId, session) {
    const inventory = await Inventory.findOne({ 
      productId, 
      warehouseId, 
      ownerId 
    }).session(session);

    if (!inventory || inventory.quantity < quantity) {
      const product = await Product.findById(productId);
      throw new Error(`Kifayət qədər stok yoxdur: ${product?.name || productId}`);
    }

    const costPriceForSale = inventory.costPrice || 0;

    inventory.quantity -= quantity;
    inventory.lastUpdated = new Date();
    await inventory.save({ session });

    await InventoryTransaction.create([{
      type: INVENTORY_TRANSACTION_TYPES.SALE,
      productId,
      ownerId,
      fromWarehouseId: warehouseId,
      quantity,
      costPrice: costPriceForSale,
      salePrice,
      saleId,
      createdBy: userId
    }], { session });

    return { ...inventory.toObject(), costPrice: costPriceForSale };
  }

  // Reverse a sale deduction: add the quantity back to the warehouse and log a
  // RETURN transaction. Recreates the inventory row if it was removed meanwhile.
  async restoreForSale(productId, warehouseId, quantity, saleId, ownerId, userId, session) {
    let inventory = await Inventory.findOne({ productId, warehouseId, ownerId }).session(session);

    if (inventory) {
      inventory.quantity += quantity;
      inventory.lastUpdated = new Date();
      await inventory.save({ session });
    } else {
      const created = await Inventory.create([{
        productId,
        warehouseId,
        ownerId,
        quantity
      }], { session });
      inventory = created[0];
    }

    await InventoryTransaction.create([{
      type: INVENTORY_TRANSACTION_TYPES.RETURN,
      productId,
      ownerId,
      toWarehouseId: warehouseId,
      quantity,
      saleId,
      note: 'Satış ləğvi - stok bərpası',
      createdBy: userId
    }], { session });

    return inventory;
  }

  async getByWarehouse(warehouseId, ownerId, canSeeCostPrice = false, user = null) {
    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) {
      throw new Error('Anbar tapılmadı');
    }

    let selectProductFields = 'name sku category brand unit recommendedPrice minPrice';
    if (canSeeCostPrice) {
      selectProductFields += ' costPrice';
    }

    const query = { warehouseId, quantity: { $gt: 0 } };
    if (user?.role !== ROLES.SUPER_OWNER && user?.role !== ROLES.EMPLOYEE) {
      query.ownerId = ownerId;
    }

    const inventory = await Inventory.find(query)
      .populate('productId', selectProductFields)
      .sort({ 'productId.name': 1 })
      .lean();

    return {
      warehouse,
      items: inventory.map(inv => ({
        product: inv.productId,
        quantity: inv.quantity,
        costPrice: canSeeCostPrice ? inv.costPrice : undefined,
        lastUpdated: inv.lastUpdated
      }))
    };
  }

  async getAll(ownerId, canSeeCostPrice = false, user = null) {
    let selectProductFields = 'name sku category brand';
    if (canSeeCostPrice) {
      selectProductFields += ' costPrice';
    }

    const query = { quantity: { $gt: 0 } };
    if (user?.role !== ROLES.SUPER_OWNER && user?.role !== ROLES.EMPLOYEE) {
      query.ownerId = ownerId;
    }

    const inventory = await Inventory.find(query)
      .populate('productId', selectProductFields)
      .populate('warehouseId', 'name code type')
      .lean();

    return inventory.map(inv => ({
      ...inv,
      costPrice: canSeeCostPrice ? inv.costPrice : undefined
    }));
  }

  async getTransactions(ownerId, filters = {}, user = null) {
    // Super owner sees every owner's movements; founders only their own.
    const query = user?.role === ROLES.SUPER_OWNER ? {} : { ownerId };

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.productId) {
      query.productId = filters.productId;
    }

    if (filters.warehouseId) {
      query.$or = [
        { fromWarehouseId: filters.warehouseId },
        { toWarehouseId: filters.warehouseId }
      ];
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
      }
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      InventoryTransaction.find(query)
        .populate('productId', 'name sku')
        .populate('fromWarehouseId', 'name code')
        .populate('toWarehouseId', 'name code')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InventoryTransaction.countDocuments(query)
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async update(inventoryId, data, ownerId, userId, user = null) {
    // Super owner can adjust any owner's stock row; founders only their own.
    const scope = user?.role === ROLES.SUPER_OWNER
      ? { _id: inventoryId }
      : { _id: inventoryId, ownerId };
    const inventory = await Inventory.findOne(scope);

    if (!inventory) {
      throw new Error('Stok tapılmadı');
    }

    // Subsequent transaction logging must use the row's real owner.
    ownerId = inventory.ownerId;

    const { quantity, costPrice } = data;
    const oldQuantity = inventory.quantity;
    const quantityDiff = quantity - oldQuantity;

    inventory.quantity = quantity;
    if (costPrice !== undefined) {
      inventory.costPrice = costPrice;
    }
    inventory.lastUpdated = new Date();
    await inventory.save();

    if (quantityDiff !== 0) {
      await InventoryTransaction.create({
        type: quantityDiff > 0 ? INVENTORY_TRANSACTION_TYPES.IN : INVENTORY_TRANSACTION_TYPES.ADJUSTMENT,
        productId: inventory.productId,
        ownerId,
        toWarehouseId: quantityDiff > 0 ? inventory.warehouseId : undefined,
        fromWarehouseId: quantityDiff < 0 ? inventory.warehouseId : undefined,
        quantity: Math.abs(quantityDiff),
        costPrice: inventory.costPrice,
        note: 'Manuel düzəliş',
        createdBy: userId
      });
    }

    return inventory;
  }

  async delete(inventoryId, ownerId, userId, user = null) {
    const scope = user?.role === ROLES.SUPER_OWNER
      ? { _id: inventoryId }
      : { _id: inventoryId, ownerId };
    const inventory = await Inventory.findOne(scope);

    if (!inventory) {
      throw new Error('Stok tapılmadı');
    }

    ownerId = inventory.ownerId;

    if (inventory.quantity > 0) {
      await InventoryTransaction.create({
        type: INVENTORY_TRANSACTION_TYPES.ADJUSTMENT,
        productId: inventory.productId,
        ownerId,
        fromWarehouseId: inventory.warehouseId,
        quantity: inventory.quantity,
        costPrice: inventory.costPrice,
        note: 'Stok silindi',
        createdBy: userId
      });
    }

    await Inventory.findByIdAndDelete(inventoryId);

    return { success: true };
  }
}

module.exports = new InventoryService();
