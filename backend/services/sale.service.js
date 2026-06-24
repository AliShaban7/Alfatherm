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
const Usta = require('../models/Usta');
const Commission = require('../models/Commission');
const Expense = require('../models/Expense');
const { PAYMENT_TYPES, ROLES, WAREHOUSE_TYPES, INVENTORY_TRANSACTION_TYPES, SALE_EXPENSE_CATEGORIES } = require('../config/constants');

// Azerbaijani labels for sale-expense categories, used in the auto-generated
// Expense description (e.g. "Kuryer - Satış SAL-...").
const SALE_EXPENSE_LABELS = {
  delivery: 'Daşınma',
  installation: 'Quraşdırma',
  other: 'Digər xərc',
  courier: 'Kuryer', // legacy
  packaging: 'Qablaşdırma' // legacy
};

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

  // Split `amount` across owners in proportion to each owner's share of the
  // sale subtotal, giving the last owner the rounding remainder so the parts
  // sum back to `amount` exactly. Returns [{ ownerId, amount }]. (Same technique
  // already used for credit-debtor allocation.)
  _splitAmountByOwner(amount, ownerSubtotals, totalAmount) {
    const ownerIds = [...ownerSubtotals.keys()];
    let allocated = 0;
    return ownerIds.map((ownerId, index) => {
      const share = index === ownerIds.length - 1
        ? Math.round((amount - allocated) * 100) / 100
        : Math.round((amount * ownerSubtotals.get(ownerId) / totalAmount) * 100) / 100;
      allocated += share;
      return { ownerId, amount: share };
    });
  }

  // Reduce a sale to a single owner's slice: keep only their line items and
  // recompute the monetary totals so their books reflect just their goods.
  sliceSaleForOwner(sale, ownerId) {
    const items = (sale.items || []).filter((item) => item.productOwnerId === ownerId);
    if (items.length === 0 || items.length === (sale.items || []).length) {
      // Nothing to slice (single-owner sale, or no item detail loaded).
      // netProfit/totalCosts are already this owner's figures.
      return sale;
    }

    const subtotal = items.reduce((sum, i) => sum + (i.total || 0), 0);
    const totalCost = items.reduce((sum, i) => sum + (i.costPrice || 0) * i.quantity, 0);
    const totalDiscount = items.reduce((sum, i) => sum + (i.discount || 0), 0);
    const profit = subtotal - totalCost;

    // This owner bears a share of the sale's extra costs (commission + expenses)
    // proportional to their slice of the whole-sale subtotal.
    const saleSubtotal = sale.subtotal || subtotal;
    const ownerCostShare = saleSubtotal > 0
      ? Math.round((sale.totalCosts || 0) * (subtotal / saleSubtotal) * 100) / 100
      : 0;

    return {
      ...sale,
      items,
      subtotal,
      totalAmount: subtotal,
      totalDiscount,
      totalCost,
      profit,
      totalCosts: ownerCostShare,
      netProfit: profit - ownerCostShare
    };
  }

  async create(saleData, user) {
    const { customerId, warehouseId, salespersonId, items, paymentType, paymentMethod, isOfficial, paidAmount, note, commission, saleExpenses, discount } = saleData;
    const userId = user._id;

    // Referral commission requested? (usta resolved in the parallel fetch below.)
    const commissionAmount = commission && Number(commission.amount) > 0 ? Number(commission.amount) : 0;

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
    const [customer, salesperson, warehouse, products, inventories, usta] = await Promise.all([
      Customer.findOne({ _id: customerId, isActive: true }).lean(),
      Salesperson.findOne({ _id: salespersonId, isActive: true }).lean(),
      Warehouse.findById(warehouseId).lean(),
      Product.find(productQuery).lean(),
      Inventory.find({ productId: { $in: productIds }, warehouseId }).lean(),
      commissionAmount > 0 && commission.ustaId
        ? Usta.findById(commission.ustaId).lean()
        : Promise.resolve(null)
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

    // Validate the referral commission (usta required when an amount is given).
    if (commissionAmount > 0) {
      if (!usta || usta.isActive === false) {
        throw new Error('Usta tapılmadı');
      }
    }

    // Normalize the on-the-spot sale expenses (drop empty rows; reject bad ones).
    const normalizedExpenses = (Array.isArray(saleExpenses) ? saleExpenses : [])
      .map((e) => ({ category: e.category, amount: Number(e.amount), note: e.note }))
      .filter((e) => e.amount > 0);
    for (const e of normalizedExpenses) {
      if (!SALE_EXPENSE_CATEGORIES.includes(e.category)) {
        throw new Error('Düzgün xərc kateqoriyası seçin');
      }
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

      // Overselling is allowed for store sales (stock may not be transferred to the
      // store yet): no hard block on insufficient stock — it goes negative and
      // reconciles when stock is entered/transferred. Cost falls back to the
      // product card when there's no live inventory cost.
      const unitCost = inventory?.costPrice ?? product.costPrice ?? 0;
      const itemCost = unitCost * item.quantity;

      // Never sell below the warehouse cost price (maya dəyəri). This is stricter
      // than the min-price floor, since the live inventory cost can rise above
      // minPrice over time.
      if (item.unitPrice < unitCost) {
        throw new Error(`"${product.name}" üçün qiymət maya dəyərindən (${unitCost.toFixed(2)} AZN) aşağı ola bilməz`);
      }

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

    // Manual whole-sale discount: clamp to [0, subtotal] and never let it push
    // the sale below cost (consistent with the per-line maya dəyəri block).
    const saleDiscount = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
    if (subtotal - saleDiscount < totalCost - 1e-6) {
      throw new Error('Endirim çox böyükdür: satış maya dəyərindən aşağı düşə bilməz');
    }

    const totalAmount = Math.round((subtotal - saleDiscount) * 100) / 100;
    const profit = totalAmount - totalCost;

    // Up-front payment on a credit sale: coerce to a number (the body sends a
    // string) and clamp to [0, totalAmount] so a stray negative or over-payment
    // can't produce a negative/!=expected remaining.
    const paidAmountNum = Math.min(Math.max(Number(paidAmount) || 0, 0), totalAmount);

    // Extra sale costs (referral commission + on-the-spot expenses). These are
    // accrued/expensed now and reduce net profit; commission also becomes a
    // payable to the usta. All are split between owners by item share.
    const expensesTotal = normalizedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalCosts = commissionAmount + expensesTotal;
    const netProfit = profit - totalCosts;

    // Distinct owners whose goods are in this sale (for per-owner reporting/isolation)
    const ownerIds = [...new Set(processedItems.map((item) => item.productOwnerId))];

    // Each owner's share of the sale subtotal — drives both the credit-debt split
    // and the cost (commission/expense) split below.
    const ownerSubtotals = new Map();
    for (const item of processedItems) {
      ownerSubtotals.set(
        item.productOwnerId,
        (ownerSubtotals.get(item.productOwnerId) || 0) + item.total
      );
    }

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
        saleDiscount,
        totalAmount,
        totalCost,
        profit,
        commission: commissionAmount > 0
          ? { ustaId: usta._id, ustaName: usta.name, amount: commissionAmount }
          : { amount: 0 },
        saleExpenses: normalizedExpenses,
        totalCosts,
        netProfit,
        paymentType,
        paymentMethod: paymentType === PAYMENT_TYPES.PREPAID ? paymentMethod : undefined,
        paidAmount: paymentType === PAYMENT_TYPES.CREDIT ? paidAmountNum : totalAmount,
        remainingAmount: paymentType === PAYMENT_TYPES.CREDIT ? (totalAmount - paidAmountNum) : 0,
        isOfficial,
        note
      }], { session });

      const createdSale = sale[0];

      // Deduct all stock in ONE bulk write. Overselling is allowed for store
      // sales: there's no `quantity >= needed` guard, and a missing store stock
      // row is created (going negative) via upsert. The balance reconciles when
      // stock is later entered/transferred into the store.
      const stockOps = processedItems.map((item) => ({
        updateOne: {
          filter: {
            productId: item.productId,
            warehouseId,
            ownerId: item.productOwnerId
          },
          update: {
            $inc: { quantity: -item.quantity },
            $set: { lastUpdated: new Date() },
            $setOnInsert: { costPrice: item.costPrice ?? 0 }
          },
          upsert: true
        }
      }));

      await Inventory.bulkWrite(stockOps, { session });

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

      // Referral commission: one payable per owner, split by item share. Accrues
      // to the usta's balance and is drawn down later in the Expenses panel.
      if (commissionAmount > 0) {
        const commissionDocs = this._splitAmountByOwner(commissionAmount, ownerSubtotals, totalAmount)
          .filter((s) => s.amount > 0)
          .map((s) => ({
            ustaId: usta._id,
            ustaName: usta.name,
            ownerId: s.ownerId,
            saleId: createdSale._id,
            branchId,
            amount: s.amount,
            remainingAmount: s.amount,
            createdBy: userId,
            date: createdSale.date
          }));
        // ordered:true is required by Mongoose when create() gets an array +
        // session (a mixed-owner sale produces one doc per owner).
        await Commission.create(commissionDocs, { session, ordered: true });
      }

      // On-the-spot sale expenses: split each row by item share into per-owner
      // Expense docs so the existing Profit/Loss report nets them per owner.
      // insertMany (not .create) skips the racy expenseNumber pre('save') hook;
      // expenseNumber is sparse, so leaving it unset is fine.
      if (normalizedExpenses.length > 0) {
        const expenseDocs = [];
        for (const e of normalizedExpenses) {
          const label = (e.category === 'other' && e.note?.trim()) ? e.note.trim() : (SALE_EXPENSE_LABELS[e.category] || e.category);
          for (const s of this._splitAmountByOwner(e.amount, ownerSubtotals, totalAmount)) {
            if (s.amount <= 0) continue;
            expenseDocs.push({
              ownerId: s.ownerId,
              isShared: false,
              branchId,
              saleId: createdSale._id,
              category: e.category,
              description: `${label} - Satış ${saleNumber}`,
              amount: s.amount,
              date: createdSale.date,
              paymentMethod: 'cash',
              createdBy: userId
            });
          }
        }
        if (expenseDocs.length > 0) {
          await Expense.insertMany(expenseDocs, { session });
        }
      }

      if (paymentType === PAYMENT_TYPES.CREDIT) {
        const totalPaid = paidAmountNum;

        // Each owner is owed the value of their own goods, NET of the whole-sale
        // discount: split the (already-discounted) totalAmount across owners by
        // their share of the gross subtotal, then allocate the upfront payment.
        const ownerNetShares = this._splitAmountByOwner(totalAmount, ownerSubtotals, subtotal);
        let allocatedPaid = 0;

        const debtorDocs = ownerNetShares.map((s, index) => {
          const ownerShare = s.amount; // net of discount
          // Give the last owner the rounding remainder so the parts sum exactly.
          const ownerPaid = index === ownerNetShares.length - 1
            ? Math.round((totalPaid - allocatedPaid) * 100) / 100
            : Math.round((totalPaid * ownerShare / totalAmount) * 100) / 100;
          allocatedPaid += ownerPaid;

          return {
            ownerId: s.ownerId,
            customerId,
            saleId: createdSale._id,
            branchId,
            totalAmount: ownerShare,
            paidAmount: ownerPaid,
            remainingAmount: Math.round((ownerShare - ownerPaid) * 100) / 100,
            createdBy: userId
          };
        });

        // ordered:true required for array create with a session (mixed-owner
        // credit sale creates one debtor per owner).
        await Debtor.create(debtorDocs, { session, ordered: true });

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
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0); // local start-of-day, so "today" begins at 00:00
        match.date.$gte = start;
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
    if (!canSeeCostPrice) unset.push('totalCost', 'profit', 'netProfit', 'totalCosts', 'commission', 'saleExpenses');

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
      selectFields += ' -totalCost -profit -netProfit -totalCosts -commission -saleExpenses -items.costPrice';
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
      //    Done as one bulk increment + one transaction insert instead of the
      //    previous ~3-round-trips-per-item loop. `upsert` recreates any stock
      //    row that was deleted between the sale and the cancel.
      const warehouseId = sale.warehouseId;
      const now = new Date();

      const restoreOps = sale.items.map((item) => ({
        updateOne: {
          filter: {
            productId: item.productId,
            warehouseId,
            ownerId: item.productOwnerId || sale.ownerId
          },
          update: { $inc: { quantity: item.quantity }, $set: { lastUpdated: now } },
          upsert: true
        }
      }));
      await Inventory.bulkWrite(restoreOps, { session });

      await InventoryTransaction.insertMany(
        sale.items.map((item) => ({
          type: INVENTORY_TRANSACTION_TYPES.RETURN,
          productId: item.productId,
          ownerId: item.productOwnerId || sale.ownerId,
          toWarehouseId: warehouseId,
          quantity: item.quantity,
          saleId: sale._id,
          note: 'Satış ləğvi - stok bərpası',
          createdBy: userId
        })),
        { session }
      );

      // 2) Reverse any receivables this sale created (credit sales may have one
      //    debtor per owner). Reduce the customer's outstanding debt by what is
      //    still owed on them before removing them.
      const debtors = await Debtor.find({ saleId: sale._id }).session(session);
      const outstandingDebt = debtors.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
      if (debtors.length) {
        await Debtor.deleteMany({ saleId: sale._id }, { session });
      }

      // 2b) Reverse the sale's extra costs: delete its split commission payables
      //     and on-the-spot expense docs. (A commission already partly paid is a
      //     rare edge case; deletion still reverses the accrual.)
      await Commission.deleteMany({ saleId: sale._id }, { session });
      await Expense.deleteMany({ saleId: sale._id }, { session });

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
    // The owner's per-item revenue is taken net of their proportional share of the
    // whole-sale discount (Endirim): subtotal = Σ items.total and totalAmount =
    // subtotal − saleDiscount, so items.total × totalAmount/subtotal spreads the
    // discount across owners by line value.
    const amount = isOwnerScoped
      ? {
          $cond: [
            { $gt: ['$subtotal', 0] },
            { $multiply: ['$items.total', { $divide: ['$totalAmount', '$subtotal'] }] },
            '$items.total'
          ]
        }
      : '$totalAmount';
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
