const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Debtor = require('../models/Debtor');
const Branch = require('../models/Branch');
const Warehouse = require('../models/Warehouse');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const Salesperson = require('../models/Salesperson');
const inventoryService = require('./inventory.service');
const { PAYMENT_TYPES, ROLES, WAREHOUSE_TYPES, INVENTORY_TRANSACTION_TYPES } = require('../config/constants');

class SaleService {
  canAccessSale(sale, user) {
    if (user.role === ROLES.SUPER_OWNER || user.role === ROLES.EMPLOYEE) {
      return true;
    }
    // An owner may view a sale if it's theirs OR contains any of their goods.
    if (sale.ownerId === user.ownerId) {
      return true;
    }
    return Array.isArray(sale.ownerIds) && sale.ownerIds.includes(user.ownerId);
  }

  // Reduce a sale to a single owner's slice: keep only their line items and
  // recompute the monetary totals so their books reflect just their goods.
  sliceSaleForOwner(sale, ownerId) {
    const items = (sale.items || []).filter((item) => item.productOwnerId === ownerId);
    if (items.length === 0 || items.length === (sale.items || []).length) {
      // Nothing to slice (single-owner sale, or no item detail loaded)
      return sale;
    }

    const subtotal = items.reduce((sum, i) => sum + (i.total || 0), 0);
    const totalCost = items.reduce((sum, i) => sum + (i.costPrice || 0) * i.quantity, 0);
    const totalDiscount = items.reduce((sum, i) => sum + (i.discount || 0), 0);

    return {
      ...sale,
      items,
      subtotal,
      totalAmount: subtotal,
      totalDiscount,
      totalCost,
      profit: subtotal - totalCost
    };
  }

  async create(saleData, user) {
    const { customerId, warehouseId, salespersonId, items, paymentType, paymentMethod, isOfficial, paidAmount, note } = saleData;
    const userId = user._id;

    // Employees and the super owner (director over both owners) may sell any
    // owner's products; a founder is limited to their own products.
    const isGeneralSales =
      user.role === ROLES.EMPLOYEE || user.role === ROLES.SUPER_OWNER;

    const productIds = items.map((item) => item.productId);
    const productQuery = { _id: { $in: productIds } };
    if (!isGeneralSales) {
      productQuery.ownerId = user.ownerId;
    }

    // Fetch everything the sale needs in parallel. Each DB query is a network
    // round-trip; doing the independent reads at once (instead of one after
    // another) is the biggest win for checkout latency.
    const [customer, salesperson, warehouse, products, inventories] = await Promise.all([
      Customer.findOne({ _id: customerId, isActive: true }).lean(),
      Salesperson.findOne({ _id: salespersonId, isActive: true }).lean(),
      Warehouse.findById(warehouseId).lean(),
      Product.find(productQuery).lean(),
      Inventory.find({ productId: { $in: productIds }, warehouseId }).lean()
    ]);

    // Customers are a shared pool, so any seller can transact with any customer.
    if (!customer) {
      throw new Error('Müştəri tapılmadı');
    }
    // Salesman is required for bonus tracking; snapshot the name onto the sale.
    if (!salesperson) {
      throw new Error('Satıcı tapılmadı');
    }
    if (!warehouse) {
      throw new Error('Anbar tapılmadı');
    }

    // The sale is anchored to the customer's owner for the receipt/customer link;
    // stock and profit are always attributed per product owner (see below).
    const saleOwnerId = customer.ownerId;

    // Branch comes from selected warehouse (not the salesperson's assigned branch)
    const branchId = warehouse.branchId || user.branchId;
    const branch = branchId ? await Branch.findById(branchId).lean() : null;

    if (!branch && warehouse.type !== WAREHOUSE_TYPES.MAIN) {
      throw new Error('Anbar üçün filial təyin olunmayıb');
    }

    const saleNumberPrefix = branch?.code || warehouse.code || 'SAL';

    const processedItems = [];
    let subtotal = 0;
    let totalCost = 0;
    let totalDiscount = 0;

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    const inventoryMap = new Map(inventories.map((inv) => [inv.productId.toString(), inv]));

    for (const item of items) {
      const product = productMap.get(String(item.productId));
      if (!product) {
        throw new Error('Məhsul tapılmadı');
      }

      if (item.unitPrice < product.minPrice) {
        throw new Error(`"${product.name}" üçün qiymət minimum qiymətdən (${product.minPrice} AZN) aşağı ola bilməz`);
      }

      const itemSubtotal = item.unitPrice * item.quantity;

      const inventory = inventoryMap.get(String(item.productId));

      if (!inventory || inventory.quantity < item.quantity) {
        throw new Error(`Kifayət qədər stok yoxdur: ${product.name}`);
      }

      // Profit uses anbar maya dəyəri (mal girişi), not məhsul kartındakı boş maya
      const unitCost = inventory.costPrice ?? product.costPrice ?? 0;
      const itemCost = unitCost * item.quantity;

      // Calculate discount as the difference between recommended and actual price
      const itemDiscount = item.unitPrice < product.recommendedPrice 
        ? (product.recommendedPrice - item.unitPrice) * item.quantity 
        : 0;
      
      const itemTotal = itemSubtotal;

      processedItems.push({
        productId: product._id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        minPrice: product.minPrice,
        costPrice: unitCost,
        discount: itemDiscount,
        total: itemTotal,
        productOwnerId: product.ownerId
      });

      subtotal += itemSubtotal;
      totalCost += itemCost;
      totalDiscount += itemDiscount;
    }

    const totalAmount = subtotal;
    const profit = totalAmount - totalCost;

    // Distinct owners whose goods are in this sale (for per-owner reporting/isolation)
    const ownerIds = [...new Set(processedItems.map((item) => item.productOwnerId))];

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const saleNumber = await Sale.generateSaleNumber(saleNumberPrefix);

      const sale = await Sale.create([{
        saleNumber,
        ownerId: saleOwnerId,
        ownerIds,
        userId,
        salespersonId,
        salespersonName: salesperson.name,
        branchId,
        warehouseId,
        customerId,
        items: processedItems,
        subtotal,
        totalDiscount,
        totalAmount,
        totalCost,
        profit,
        paymentType,
        paymentMethod: paymentType === PAYMENT_TYPES.PREPAID ? paymentMethod : undefined,
        paidAmount: paymentType === PAYMENT_TYPES.CREDIT ? (paidAmount || 0) : totalAmount,
        remainingAmount: paymentType === PAYMENT_TYPES.CREDIT ? (totalAmount - (paidAmount || 0)) : 0,
        isOfficial,
        note
      }], { session });

      const createdSale = sale[0];

      // Deduct all stock in ONE bulk write. The `quantity >= needed` filter makes
      // each decrement atomic, so concurrent sales can't oversell (a non-matching
      // row simply isn't modified). Then record all SALE movements in one insert.
      // This replaces the previous 3-round-trips-per-item loop.
      const stockOps = processedItems.map((item) => ({
        updateOne: {
          filter: {
            productId: item.productId,
            warehouseId,
            ownerId: item.productOwnerId,
            quantity: { $gte: item.quantity }
          },
          update: { $inc: { quantity: -item.quantity }, $set: { lastUpdated: new Date() } }
        }
      }));

      const stockResult = await Inventory.bulkWrite(stockOps, { session });
      if (stockResult.modifiedCount !== processedItems.length) {
        // Stock changed between validation and deduction (concurrent sale).
        throw new Error('Kifayət qədər stok yoxdur');
      }

      await InventoryTransaction.insertMany(
        processedItems.map((item) => ({
          type: INVENTORY_TRANSACTION_TYPES.SALE,
          productId: item.productId,
          ownerId: item.productOwnerId,
          fromWarehouseId: warehouseId,
          quantity: item.quantity,
          costPrice: item.costPrice,
          salePrice: item.unitPrice,
          saleId: createdSale._id,
          createdBy: userId
        })),
        { session }
      );

      if (paymentType === PAYMENT_TYPES.CREDIT) {
        const totalPaid = paidAmount || 0;

        // Each owner is owed the value of their own goods. Allocate the buyer's
        // upfront payment across owners in proportion to their share of the sale
        // so every founder's receivable reflects only what they're actually owed.
        const ownerSubtotals = new Map();
        for (const item of processedItems) {
          ownerSubtotals.set(
            item.productOwnerId,
            (ownerSubtotals.get(item.productOwnerId) || 0) + item.total
          );
        }

        const debtorOwnerIds = [...ownerSubtotals.keys()];
        let allocatedPaid = 0;

        const debtorDocs = debtorOwnerIds.map((debtorOwnerId, index) => {
          const ownerShare = ownerSubtotals.get(debtorOwnerId);
          // Give the last owner the rounding remainder so the parts sum exactly.
          const ownerPaid = index === debtorOwnerIds.length - 1
            ? totalPaid - allocatedPaid
            : Math.round((totalPaid * ownerShare / totalAmount) * 100) / 100;
          allocatedPaid += ownerPaid;

          return {
            ownerId: debtorOwnerId,
            customerId,
            saleId: createdSale._id,
            branchId,
            totalAmount: ownerShare,
            paidAmount: ownerPaid,
            remainingAmount: ownerShare - ownerPaid,
            createdBy: userId
          };
        });

        await Debtor.create(debtorDocs, { session });

        await Customer.findByIdAndUpdate(customerId, {
          $inc: {
            totalPurchases: totalAmount,
            totalDebt: totalAmount - totalPaid
          }
        }, { session });
      } else {
        await Customer.findByIdAndUpdate(customerId, {
          $inc: { totalPurchases: totalAmount }
        }, { session });
      }

      await session.commitTransaction();

      const saleObj = createdSale.toObject();
      return {
        ...saleObj,
        userId: { _id: userId, name: user.name },
        customerId: { _id: customer._id, name: customer.name },
        warehouseId: { _id: warehouse._id, name: warehouse.name, code: warehouse.code },
        ...(branch && {
          branchId: { _id: branch._id, name: branch.name, code: branch.code }
        })
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getAll(ownerFilter = {}, filters = {}, canSeeCostPrice = false, user = null) {
    const isOwnerScoped = user?.role === ROLES.OWNER;

    // Build the $match. ObjectId fields must be cast explicitly for aggregation
    // (unlike find(), aggregate doesn't auto-cast string ids).
    const match = { ...ownerFilter };

    if (filters.branchId && mongoose.isValidObjectId(filters.branchId)) {
      match.branchId = new mongoose.Types.ObjectId(filters.branchId);
    }
    if (filters.customerId && mongoose.isValidObjectId(filters.customerId)) {
      match.customerId = new mongoose.Types.ObjectId(filters.customerId);
    }
    if (filters.paymentType) {
      match.paymentType = filters.paymentType;
    }
    if (filters.status) {
      match.status = filters.status;
    }
    if (filters.search?.trim()) {
      const term = filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      match.saleNumber = { $regex: term, $options: 'i' };
    }
    if (filters.startDate || filters.endDate) {
      match.date = {};
      if (filters.startDate) {
        match.date.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        match.date.$lte = end;
      }
    }

    const page = parseInt(filters.page, 10) || 1;
    const limit = Math.min(parseInt(filters.limit, 10) || 25, 100);
    const skip = (page - 1) * limit;

    // Drop fields the list doesn't need (and cost/profit for non-owners). Owners
    // keep items to recompute their slice of mixed sales.
    const unset = ['__v'];
    if (!isOwnerScoped) unset.push('items');
    if (!canSeeCostPrice) unset.push('totalCost', 'profit');

    // Single round-trip: page the sales, THEN join the few referenced docs (so
    // the $lookups only touch `limit` rows, not the whole collection). This
    // replaces find() + 4 separate populate queries.
    const lookup = (from, field, project) => ([
      { $lookup: { from, localField: field, foreignField: '_id', pipeline: [{ $project: project }], as: field } },
      { $unwind: { path: `$${field}`, preserveNullAndEmptyArrays: true } }
    ]);

    const pipeline = [
      { $match: match },
      { $sort: { date: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $unset: unset },
      ...lookup('customers', 'customerId', { name: 1, phone: 1, type: 1 }),
      ...lookup('warehouses', 'warehouseId', { name: 1, code: 1 }),
      ...lookup('branches', 'branchId', { name: 1, code: 1 })
    ];

    // estimatedDocumentCount() is instant (metadata); countDocuments scans, so
    // only use it when there's an actual filter.
    const isUnfiltered = Object.keys(match).length === 0;

    const [sales, total] = await Promise.all([
      Sale.aggregate(pipeline),
      isUnfiltered ? Sale.estimatedDocumentCount() : Sale.countDocuments(match)
    ]);

    const shapedSales = isOwnerScoped
      ? sales.map((sale) => {
          const sliced = this.sliceSaleForOwner(sale, user.ownerId);
          delete sliced.items; // list view doesn't render line items
          return sliced;
        })
      : sales;

    return {
      sales: shapedSales,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1
      }
    };
  }

  async getById(id, ownerFilter = {}, canSeeCostPrice = false, user = null) {
    let selectFields = '-__v';
    if (!canSeeCostPrice) {
      selectFields += ' -totalCost -profit -items.costPrice';
    }

    const sale = await Sale.findById(id)
      .select(selectFields)
      .populate('customerId', 'name phone type address voen')
      .populate('branchId', 'name code address')
      .populate('warehouseId', 'name code')
      .populate('userId', 'name email')
      .lean();

    if (!sale) {
      throw new Error('Satış tapılmadı');
    }

    if (user && !this.canAccessSale(sale, user)) {
      const err = new Error('Bu satışa baxış icazəniz yoxdur');
      err.statusCode = 403;
      throw err;
    }

    // A founder viewing a mixed sale sees only their own goods and totals.
    if (user?.role === ROLES.OWNER) {
      return this.sliceSaleForOwner(sale, user.ownerId);
    }

    return sale;
  }

  async cancel(id, ownerFilter = {}, userId, user = null) {
    const sale = await Sale.findById(id);

    if (!sale) {
      throw new Error('Satış tapılmadı');
    }

    if (user && !this.canAccessSale(sale, user)) {
      const err = new Error('Bu satışı ləğv etmək üçün icazəniz yoxdur');
      err.statusCode = 403;
      throw err;
    }

    if (sale.status === 'cancelled') {
      throw new Error('Bu satış artıq ləğv edilib');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1) Return each line's stock to the warehouse it was sold from, attributed
      //    to that line's product owner (mixed-owner sales restore correctly).
      for (const item of sale.items) {
        await inventoryService.restoreForSale(
          item.productId,
          sale.warehouseId,
          item.quantity,
          sale._id,
          item.productOwnerId || sale.ownerId,
          userId,
          session
        );
      }

      // 2) Reverse any receivables this sale created (credit sales may have one
      //    debtor per owner). Reduce the customer's outstanding debt by what is
      //    still owed on them before removing them.
      const debtors = await Debtor.find({ saleId: sale._id }).session(session);
      const outstandingDebt = debtors.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
      if (debtors.length) {
        await Debtor.deleteMany({ saleId: sale._id }, { session });
      }

      // 3) Roll back the customer's running totals.
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: {
          totalPurchases: -sale.totalAmount,
          totalDebt: -outstandingDebt
        }
      }, { session });

      sale.status = 'cancelled';
      await sale.save({ session });

      await session.commitTransaction();
      return sale;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Available quantity per product in one warehouse, for the New Sale screen.
  // Returns a { [productId]: quantity } map. Employees/super owner see every
  // owner's stock in that warehouse (they can sell any owner's goods); a
  // founder sees only their own products' stock.
  async getWarehouseStock(warehouseId, user) {
    const query = { warehouseId, quantity: { $gt: 0 } };
    if (user?.role === ROLES.OWNER) {
      query.ownerId = user.ownerId;
    }

    const rows = await Inventory.find(query).select('productId quantity').lean();

    const stock = {};
    for (const row of rows) {
      stock[row.productId.toString()] = row.quantity;
    }
    return stock;
  }

  async getDailySummary(user, branchId, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const matchQuery = {
      date: { $gte: startOfDay, $lte: endOfDay },
      status: 'completed'
    };

    if (branchId) {
      matchQuery.branchId = new mongoose.Types.ObjectId(branchId);
    }

    // Owners are scoped to sales containing their goods and see only their slice;
    // super owners see every owner's full figures.
    const isOwnerScoped = user?.role === ROLES.OWNER;
    if (isOwnerScoped) {
      matchQuery.ownerIds = user.ownerId;
    }

    // Per-sale vs per-item value depending on whether we're slicing by owner.
    const amount = isOwnerScoped ? '$items.total' : '$totalAmount';
    const cost = isOwnerScoped
      ? { $multiply: ['$items.costPrice', '$items.quantity'] }
      : '$totalCost';

    const pipeline = [{ $match: matchQuery }];
    if (isOwnerScoped) {
      pipeline.push(
        { $unwind: '$items' },
        { $match: { 'items.productOwnerId': user.ownerId } }
      );
    }
    pipeline.push({
      $group: {
        _id: null,
        // Count distinct sales (item-level unwind would otherwise overcount).
        saleIds: { $addToSet: '$_id' },
        totalAmount: { $sum: amount },
        totalCost: { $sum: cost },
        cashSales: {
          $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, amount, 0] }
        },
        posSales: {
          $sum: { $cond: [{ $eq: ['$paymentMethod', 'pos'] }, amount, 0] }
        },
        bankSales: {
          $sum: { $cond: [{ $eq: ['$paymentMethod', 'bank'] }, amount, 0] }
        },
        creditSales: {
          $sum: { $cond: [{ $eq: ['$paymentType', 'credit'] }, amount, 0] }
        }
      }
    });

    const result = await Sale.aggregate(pipeline);
    const agg = result[0];
    const summary = agg
      ? {
          totalSales: agg.saleIds.length,
          totalAmount: agg.totalAmount,
          totalCost: agg.totalCost,
          totalProfit: agg.totalAmount - agg.totalCost,
          cashSales: agg.cashSales,
          posSales: agg.posSales,
          bankSales: agg.bankSales,
          creditSales: agg.creditSales
        }
      : null;

    return summary || {
      totalSales: 0,
      totalAmount: 0,
      totalCost: 0,
      totalProfit: 0,
      cashSales: 0,
      posSales: 0,
      bankSales: 0,
      creditSales: 0
    };
  }
}

module.exports = new SaleService();
