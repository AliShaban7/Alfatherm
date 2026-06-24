const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const Debtor = require('../models/Debtor');
const Creditor = require('../models/Creditor');
const Expense = require('../models/Expense');
const Product = require('../models/Product');
const Commission = require('../models/Commission');
const Salesperson = require('../models/Salesperson');
const { ROLES } = require('../config/constants');

// A founder (OWNER) sees only the goods they own, even inside a sale that mixes
// several owners' products. A SUPER_OWNER sees every owner's full figures.
const isOwnerScoped = (user) => user?.role === ROLES.OWNER;

// Inclusive end-of-day for a date-only filter. The report UI sends YYYY-MM-DD,
// which parses to midnight; using it as `$lte` directly would exclude every sale
// made later that same day (e.g. today's sales). Push it to 23:59:59.999.
const endOfDay = (d) => {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
};

class ReportService {
  // Leading $match for a sales pipeline. Owners are restricted to sales that
  // contain their goods; super owners match all owners.
  _salesMatch(user, extra = {}) {
    const match = { status: 'completed', ...extra };
    if (isOwnerScoped(user)) {
      match.ownerIds = user.ownerId;
    }
    return match;
  }

  // Stages that narrow a sale to a single owner's line items. Empty for super
  // owners (who keep whole-sale figures).
  _ownerItemStages(user) {
    if (!isOwnerScoped(user)) return [];
    return [
      { $unwind: '$items' },
      { $match: { 'items.productOwnerId': user.ownerId } }
    ];
  }

  // A single line item's revenue, NET of the whole-sale discount (Endirim).
  // subtotal = Σ items.total and totalAmount = subtotal − saleDiscount, so scaling
  // each line by totalAmount/subtotal spreads the manual discount across the sale's
  // owners in proportion to their line value. Requires an unwound `$items`.
  _netLineAmountExpr() {
    return {
      $cond: [
        { $gt: ['$subtotal', 0] },
        { $multiply: ['$items.total', { $divide: ['$totalAmount', '$subtotal'] }] },
        '$items.total'
      ]
    };
  }

  // Revenue/cost expressions: per-item when slicing by owner, per-sale otherwise.
  // For an owner the per-item revenue is taken net of their proportional share of
  // the whole-sale discount, so a founder's reported revenue/profit reflects the
  // Endirim instead of their full gross line total.
  _amountExpr(user) {
    return isOwnerScoped(user) ? this._netLineAmountExpr() : '$totalAmount';
  }

  _costExpr(user) {
    return isOwnerScoped(user)
      ? { $multiply: ['$items.costPrice', '$items.quantity'] }
      : '$totalCost';
  }

  // Reusable {count, totalAmount, totalProfit} over a date range.
  async _salesSummary(user, dateRange, branchId) {
    const extra = {};
    if (branchId) extra.branchId = new mongoose.Types.ObjectId(branchId);
    if (dateRange) extra.date = dateRange;

    const pipeline = [
      { $match: this._salesMatch(user, extra) },
      ...this._ownerItemStages(user),
      {
        $group: {
          _id: null,
          // addToSet so an item-level unwind doesn't overcount sales
          saleIds: { $addToSet: '$_id' },
          totalAmount: { $sum: this._amountExpr(user) },
          totalCost: { $sum: this._costExpr(user) }
        }
      }
    ];

    const r = (await Sale.aggregate(pipeline))[0];
    return r
      ? { count: r.saleIds.length, totalAmount: r.totalAmount, totalProfit: r.totalAmount - r.totalCost }
      : { count: 0, totalAmount: 0, totalProfit: 0 };
  }

  async getDashboardSummary(user, branchId = null) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    // Debtors/creditors/inventory are stored per-owner already (credit debt is
    // split per owner at sale time), so a simple ownerId filter is correct.
    const ownerMatch = isOwnerScoped(user) ? { ownerId: user.ownerId } : {};

    const [
      today_,
      month,
      totalDebtors,
      totalCreditors,
      lowStockProducts
    ] = await Promise.all([
      this._salesSummary(user, { $gte: startOfDay, $lte: endOfDay }, branchId),
      this._salesSummary(user, { $gte: startOfMonth, $lte: endOfMonth }, branchId),
      Debtor.aggregate([
        { $match: { ...ownerMatch, status: { $ne: 'paid' } } },
        { $group: { _id: null, count: { $sum: 1 }, totalRemaining: { $sum: '$remainingAmount' } } }
      ]),
      Creditor.aggregate([
        { $match: { ...ownerMatch, status: { $ne: 'paid' } } },
        { $group: { _id: null, count: { $sum: 1 }, totalRemaining: { $sum: '$remainingAmount' } } }
      ]),
      Inventory.aggregate([
        { $match: { ...ownerMatch, quantity: { $lte: 5, $gt: 0 } } },
        { $count: 'count' }
      ])
    ]);

    return {
      today: today_,
      month,
      debtors: totalDebtors[0] || { count: 0, totalRemaining: 0 },
      creditors: totalCreditors[0] || { count: 0, totalRemaining: 0 },
      lowStockProducts: lowStockProducts[0]?.count || 0
    };
  }

  async getPeriodStats(user, startDate, endDate) {
    let dateRange = null;
    if (startDate || endDate) {
      dateRange = {};
      if (startDate) dateRange.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateRange.$lte = end;
      }
    }

    return this._salesSummary(user, dateRange, null);
  }

  async getSalesReport(user, filters = {}) {
    const { startDate, endDate, branchId, groupBy = 'day' } = filters;

    const extra = {};
    if (branchId) extra.branchId = new mongoose.Types.ObjectId(branchId);
    if (startDate || endDate) {
      extra.date = {};
      if (startDate) extra.date.$gte = new Date(startDate);
      if (endDate) extra.date.$lte = endOfDay(endDate);
    }

    let groupByField;
    switch (groupBy) {
      case 'month':
        groupByField = { year: { $year: '$date' }, month: { $month: '$date' } };
        break;
      case 'week':
        groupByField = { year: { $year: '$date' }, week: { $week: '$date' } };
        break;
      default:
        groupByField = { year: { $year: '$date' }, month: { $month: '$date' }, day: { $dayOfMonth: '$date' } };
    }

    const amount = this._amountExpr(user);
    const cost = this._costExpr(user);
    const pre = [
      { $match: this._salesMatch(user, extra) },
      // For credit sales bring in the LIVE outstanding from the debtor (the Sale's
      // own remainingAmount isn't updated when debt is collected later), so the
      // Nisyə column shows actual debt — not the gross credit sale.
      { $lookup: { from: Debtor.collection.name, localField: '_id', foreignField: 'saleId', as: '_debtors' } },
      {
        $addFields: {
          _remaining: {
            $cond: [
              { $eq: ['$paymentType', 'credit'] },
              {
                $cond: [
                  { $gt: [{ $size: '$_debtors' }, 0] },
                  { $sum: '$_debtors.remainingAmount' },
                  { $ifNull: ['$remainingAmount', 0] }
                ]
              },
              0
            ]
          }
        }
      },
      {
        $addFields: {
          _unpaidFrac: { $cond: [{ $gt: ['$totalAmount', 0] }, { $divide: ['$_remaining', '$totalAmount'] }, 0] }
        }
      },
      ...this._ownerItemStages(user)
    ];

    const report = await Sale.aggregate([
      ...pre,
      {
        $group: {
          _id: groupByField,
          saleIds: { $addToSet: '$_id' },
          totalAmount: { $sum: amount },
          totalCost: { $sum: cost },
          cashSales: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, amount, 0] } },
          posSales: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'pos'] }, amount, 0] } },
          bankSales: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'bank'] }, amount, 0] } },
          creditSales: { $sum: { $multiply: [amount, '$_unpaidFrac'] } }
        }
      },
      {
        $addFields: {
          salesCount: { $size: '$saleIds' },
          totalProfit: { $subtract: ['$totalAmount', '$totalCost'] }
        }
      },
      { $project: { saleIds: 0 } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    const totals = await Sale.aggregate([
      ...pre,
      {
        $group: {
          _id: null,
          saleIds: { $addToSet: '$_id' },
          totalAmount: { $sum: amount },
          totalCost: { $sum: cost }
        }
      },
      {
        $addFields: {
          salesCount: { $size: '$saleIds' },
          totalProfit: { $subtract: ['$totalAmount', '$totalCost'] }
        }
      },
      { $project: { saleIds: 0 } }
    ]);

    return {
      data: report,
      totals: totals[0] || { salesCount: 0, totalAmount: 0, totalCost: 0, totalProfit: 0 }
    };
  }

  async getProductSalesReport(user, filters = {}) {
    const { startDate, endDate, branchId, limit = 20 } = filters;

    const extra = {};
    if (branchId) extra.branchId = new mongoose.Types.ObjectId(branchId);
    if (startDate || endDate) {
      extra.date = {};
      if (startDate) extra.date.$gte = new Date(startDate);
      if (endDate) extra.date.$lte = endOfDay(endDate);
    }

    // Always unwind to the product line; for owners also drop other owners' lines.
    const itemMatch = isOwnerScoped(user)
      ? [{ $match: { 'items.productOwnerId': user.ownerId } }]
      : [];

    const report = await Sale.aggregate([
      { $match: this._salesMatch(user, extra) },
      { $unwind: '$items' },
      ...itemMatch,
      {
        $group: {
          _id: '$items.productId',
          productName: { $first: '$items.productName' },
          totalQuantity: { $sum: '$items.quantity' },
          // Net of the whole-sale discount, so per-product revenue/profit matches
          // the discounted sale totals (consistent with the sales & P&L reports).
          totalAmount: { $sum: this._netLineAmountExpr() },
          totalCost: { $sum: { $multiply: ['$items.costPrice', '$items.quantity'] } },
          totalProfit: {
            $sum: {
              $subtract: [this._netLineAmountExpr(), { $multiply: ['$items.costPrice', '$items.quantity'] }]
            }
          }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: parseInt(limit) }
    ]);

    return report;
  }

  async getInventoryReport(user, canSeeCostPrice = false) {
    const match = isOwnerScoped(user) ? { ownerId: user.ownerId } : {};

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'warehouses',
          localField: 'warehouseId',
          foreignField: '_id',
          as: 'warehouse'
        }
      },
      { $unwind: '$warehouse' },
      {
        $group: {
          _id: '$warehouseId',
          warehouseName: { $first: '$warehouse.name' },
          warehouseType: { $first: '$warehouse.type' },
          totalProducts: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: {
            $sum: { $multiply: ['$quantity', { $ifNull: ['$costPrice', '$product.costPrice'] }] }
          },
          totalRetailValue: {
            $sum: { $multiply: ['$quantity', '$product.recommendedPrice'] }
          }
        }
      },
      { $sort: { warehouseName: 1 } }
    ];

    const report = await Inventory.aggregate(pipeline);

    const totals = report.reduce((acc, wh) => ({
      totalProducts: acc.totalProducts + wh.totalProducts,
      totalQuantity: acc.totalQuantity + wh.totalQuantity,
      totalValue: acc.totalValue + wh.totalValue,
      totalRetailValue: acc.totalRetailValue + wh.totalRetailValue
    }), { totalProducts: 0, totalQuantity: 0, totalValue: 0, totalRetailValue: 0 });

    if (!canSeeCostPrice) {
      report.forEach(wh => delete wh.totalValue);
      delete totals.totalValue;
    }

    return {
      byWarehouse: report,
      totals
    };
  }

  async getBranchReport(user, filters = {}) {
    const { startDate, endDate } = filters;

    const extra = {};
    if (startDate || endDate) {
      extra.date = {};
      if (startDate) extra.date.$gte = new Date(startDate);
      if (endDate) extra.date.$lte = endOfDay(endDate);
    }

    const amount = this._amountExpr(user);
    const cost = this._costExpr(user);

    const report = await Sale.aggregate([
      { $match: this._salesMatch(user, extra) },
      ...this._ownerItemStages(user),
      {
        $lookup: {
          from: 'branches',
          localField: 'branchId',
          foreignField: '_id',
          as: 'branch'
        }
      },
      { $unwind: '$branch' },
      {
        $group: {
          _id: '$branchId',
          branchName: { $first: '$branch.name' },
          branchCode: { $first: '$branch.code' },
          saleIds: { $addToSet: '$_id' },
          totalAmount: { $sum: amount },
          totalCost: { $sum: cost }
        }
      },
      {
        $addFields: {
          salesCount: { $size: '$saleIds' },
          totalProfit: { $subtract: ['$totalAmount', '$totalCost'] }
        }
      },
      { $project: { saleIds: 0 } },
      { $sort: { totalAmount: -1 } }
    ]);

    return report;
  }

  // Per-salesman totals for the bonus system. Owners see only the value of
  // their own goods sold by each salesman; super owner sees the full figures.
  async getSalespersonReport(user, filters = {}) {
    const { startDate, endDate, branchId } = filters;

    const extra = {};
    if (branchId) extra.branchId = new mongoose.Types.ObjectId(branchId);
    if (startDate || endDate) {
      extra.date = {};
      if (startDate) extra.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        extra.date.$lte = end;
      }
    }

    const amount = this._amountExpr(user);
    const cost = this._costExpr(user);
    const profit = { $subtract: [amount, cost] };

    const report = await Sale.aggregate([
      { $match: { ...this._salesMatch(user, extra), salespersonId: { $ne: null } } },
      // How much of each sale has actually been collected: prepaid sales are fully
      // collected; credit sales accrue through Debtor payments (the Sale's own
      // paidAmount is not updated on collection, so read it from the debtor).
      {
        $lookup: {
          from: Debtor.collection.name,
          localField: '_id',
          foreignField: 'saleId',
          as: '_debtors'
        }
      },
      { $addFields: { _paid: { $sum: '$_debtors.paidAmount' } } },
      {
        $addFields: {
          collectedFraction: {
            $cond: [
              { $eq: ['$paymentType', 'prepaid'] },
              1,
              {
                $cond: [
                  { $gt: ['$totalAmount', 0] },
                  { $min: [1, { $divide: ['$_paid', '$totalAmount'] }] },
                  0
                ]
              }
            ]
          }
        }
      },
      ...this._ownerItemStages(user),
      {
        $group: {
          _id: '$salespersonId',
          salespersonName: { $first: '$salespersonName' },
          saleIds: { $addToSet: '$_id' },
          totalAmount: { $sum: amount },
          totalCost: { $sum: cost },
          collectedAmount: { $sum: { $multiply: [amount, '$collectedFraction'] } },
          recognizedProfit: { $sum: { $multiply: [profit, '$collectedFraction'] } }
        }
      },
      {
        $addFields: {
          salesCount: { $size: '$saleIds' },
          totalProfit: { $subtract: ['$totalAmount', '$totalCost'] },
          // Uncollected revenue on this salesperson's sales (their debtors).
          outstanding: { $subtract: ['$totalAmount', '$collectedAmount'] }
        }
      },
      // Attach each salesperson's bonus rate.
      {
        $lookup: {
          from: Salesperson.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: '_sp'
        }
      },
      { $addFields: { bonusRate: { $ifNull: [{ $first: '$_sp.bonusRate' }, 0] } } },
      {
        $addFields: {
          // Bonus = rate × profit, recognized only on the collected portion.
          bonusEarned: {
            $round: [{ $multiply: ['$recognizedProfit', { $divide: ['$bonusRate', 100] }] }, 2]
          },
          bonusPending: {
            $round: [
              { $multiply: [{ $subtract: ['$totalProfit', '$recognizedProfit'] }, { $divide: ['$bonusRate', 100] }] },
              2
            ]
          }
        }
      },
      { $project: { saleIds: 0, _sp: 0 } },
      { $sort: { totalAmount: -1 } }
    ]);

    return report;
  }

  async getProfitLossReport(user, filters = {}) {
    const { startDate, endDate, branchId } = filters;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = endOfDay(endDate);

    const salesExtra = {};
    // Exclude settlement expenses (e.g. usta commission payments): they're shown
    // in the expenses list for visibility, but the cost they settle was already
    // accrued (commission via the Commission ledger), so counting them here too
    // would double-count.
    const expenseMatchQuery = { isSettlement: { $ne: true } };

    if (branchId) {
      salesExtra.branchId = new mongoose.Types.ObjectId(branchId);
      expenseMatchQuery.branchId = new mongoose.Types.ObjectId(branchId);
    }

    if (startDate || endDate) {
      salesExtra.date = dateFilter;
      expenseMatchQuery.date = dateFilter;
    }

    // Founders carry their own expenses plus shared ones; super owners see all.
    if (isOwnerScoped(user)) {
      expenseMatchQuery.$or = [
        { ownerId: user.ownerId },
        { isShared: true }
      ];
    }

    // Referral commission is accrued per owner in its own ledger (not the Expense
    // collection), so add it as a cost line here. Owner-scoped to ownerId; same
    // date/branch window. (Courier/packaging already come through Expense.)
    const commissionMatchQuery = {};
    if (branchId) commissionMatchQuery.branchId = new mongoose.Types.ObjectId(branchId);
    if (startDate || endDate) commissionMatchQuery.date = dateFilter;
    if (isOwnerScoped(user)) commissionMatchQuery.ownerId = user.ownerId;

    const amount = this._amountExpr(user);
    const cost = this._costExpr(user);

    const [salesData, expenseData, commissionData] = await Promise.all([
      Sale.aggregate([
        { $match: this._salesMatch(user, salesExtra) },
        // Collected fraction per sale (prepaid = fully collected; credit = via the
        // debtor's live remaining), so we can split gross profit into the part
        // realized in cash vs the part still locked in debtors.
        { $lookup: { from: Debtor.collection.name, localField: '_id', foreignField: 'saleId', as: '_debtors' } },
        {
          $addFields: {
            _remaining: {
              $cond: [
                { $eq: ['$paymentType', 'credit'] },
                {
                  $cond: [
                    { $gt: [{ $size: '$_debtors' }, 0] },
                    { $sum: '$_debtors.remainingAmount' },
                    { $ifNull: ['$remainingAmount', 0] }
                  ]
                },
                0
              ]
            }
          }
        },
        {
          $addFields: {
            _collFrac: {
              $cond: [
                { $gt: ['$totalAmount', 0] },
                { $divide: [{ $subtract: ['$totalAmount', '$_remaining'] }, '$totalAmount'] },
                1
              ]
            }
          }
        },
        ...this._ownerItemStages(user),
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: amount },
            totalCost: { $sum: cost },
            realizedProfit: { $sum: { $multiply: [{ $subtract: [amount, cost] }, '$_collFrac'] } }
          }
        }
      ]),
      Expense.aggregate([
        { $match: expenseMatchQuery },
        { $group: { _id: '$category', amount: { $sum: '$amount' } } }
      ]),
      Commission.aggregate([
        { $match: commissionMatchQuery },
        { $group: { _id: null, amount: { $sum: '$amount' } } }
      ])
    ]);

    const salesAgg = salesData[0] || { totalRevenue: 0, totalCost: 0, realizedProfit: 0 };
    const grossProfit = salesAgg.totalRevenue - salesAgg.totalCost;
    // Split: realized = collected portion of gross profit; unrealized = the margin
    // still sitting in open debtors (recognized on accrual, not yet in cash).
    const realizedProfit = Math.round((salesAgg.realizedProfit || 0) * 100) / 100;
    const unrealizedProfit = Math.round((grossProfit - realizedProfit) * 100) / 100;

    // Merge accrued commission into the expense breakdown as its own line.
    const commissionAccrued = commissionData[0]?.amount || 0;
    if (commissionAccrued > 0) {
      expenseData.push({ _id: 'commission', amount: commissionAccrued });
    }

    const totalExpenses = expenseData.reduce((sum, exp) => sum + exp.amount, 0);
    const netProfit = grossProfit - totalExpenses;

    return {
      revenue: salesAgg.totalRevenue,
      costOfGoods: salesAgg.totalCost,
      grossProfit,
      realizedProfit,    // collected (cash-realized) gross profit
      unrealizedProfit,  // gross profit still owed by debtors
      expenses: {
        byCategory: expenseData,
        total: totalExpenses
      },
      netProfit,
      profitMargin: salesAgg.totalRevenue > 0
        ? ((netProfit / salesAgg.totalRevenue) * 100).toFixed(2)
        : 0
    };
  }
}

module.exports = new ReportService();
