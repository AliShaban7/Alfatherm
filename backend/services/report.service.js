const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const Debtor = require('../models/Debtor');
const Creditor = require('../models/Creditor');
const Expense = require('../models/Expense');
const Product = require('../models/Product');

class ReportService {
  async getDashboardSummary(ownerId, branchId = null) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const matchQuery = { ownerId, status: 'completed' };
    if (branchId) {
      matchQuery.branchId = new mongoose.Types.ObjectId(branchId);
    }

    const [
      todaySales,
      monthSales,
      totalDebtors,
      totalCreditors,
      lowStockProducts
    ] = await Promise.all([
      Sale.aggregate([
        { $match: { ...matchQuery, date: { $gte: startOfDay, $lte: endOfDay } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
            totalProfit: { $sum: '$profit' }
          }
        }
      ]),
      Sale.aggregate([
        { $match: { ...matchQuery, date: { $gte: startOfMonth, $lte: endOfMonth } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
            totalProfit: { $sum: '$profit' }
          }
        }
      ]),
      Debtor.aggregate([
        { $match: { ownerId, status: { $ne: 'paid' } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalRemaining: { $sum: '$remainingAmount' }
          }
        }
      ]),
      Creditor.aggregate([
        { $match: { ownerId, status: { $ne: 'paid' } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalRemaining: { $sum: '$remainingAmount' }
          }
        }
      ]),
      Inventory.aggregate([
        { $match: { ownerId, quantity: { $lte: 5, $gt: 0 } } },
        { $count: 'count' }
      ])
    ]);

    return {
      today: todaySales[0] || { count: 0, totalAmount: 0, totalProfit: 0 },
      month: monthSales[0] || { count: 0, totalAmount: 0, totalProfit: 0 },
      debtors: totalDebtors[0] || { count: 0, totalRemaining: 0 },
      creditors: totalCreditors[0] || { count: 0, totalRemaining: 0 },
      lowStockProducts: lowStockProducts[0]?.count || 0
    };
  }

  async getSalesReport(ownerId, filters = {}) {
    const { startDate, endDate, branchId, groupBy = 'day' } = filters;

    const matchQuery = { ownerId, status: 'completed' };

    if (branchId) {
      matchQuery.branchId = new mongoose.Types.ObjectId(branchId);
    }

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate);
      if (endDate) matchQuery.date.$lte = new Date(endDate);
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

    const report = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: groupByField,
          salesCount: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalCost: { $sum: '$totalCost' },
          totalProfit: { $sum: '$profit' },
          cashSales: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$totalAmount', 0] }
          },
          posSales: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'pos'] }, '$totalAmount', 0] }
          },
          bankSales: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'bank'] }, '$totalAmount', 0] }
          },
          creditSales: {
            $sum: { $cond: [{ $eq: ['$paymentType', 'credit'] }, '$totalAmount', 0] }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    const totals = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          salesCount: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalCost: { $sum: '$totalCost' },
          totalProfit: { $sum: '$profit' }
        }
      }
    ]);

    return {
      data: report,
      totals: totals[0] || { salesCount: 0, totalAmount: 0, totalCost: 0, totalProfit: 0 }
    };
  }

  async getProductSalesReport(ownerId, filters = {}) {
    const { startDate, endDate, branchId, limit = 20 } = filters;

    const matchQuery = { ownerId, status: 'completed' };

    if (branchId) {
      matchQuery.branchId = new mongoose.Types.ObjectId(branchId);
    }

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate);
      if (endDate) matchQuery.date.$lte = new Date(endDate);
    }

    const report = await Sale.aggregate([
      { $match: matchQuery },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          productName: { $first: '$items.productName' },
          totalQuantity: { $sum: '$items.quantity' },
          totalAmount: { $sum: '$items.total' },
          totalCost: { $sum: { $multiply: ['$items.costPrice', '$items.quantity'] } },
          totalProfit: {
            $sum: {
              $subtract: [
                '$items.total',
                { $multiply: ['$items.costPrice', '$items.quantity'] }
              ]
            }
          }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: parseInt(limit) }
    ]);

    return report;
  }

  async getInventoryReport(ownerId, canSeeCostPrice = false) {
    const pipeline = [
      { $match: { ownerId } },
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

  async getBranchReport(ownerId, filters = {}) {
    const { startDate, endDate } = filters;

    const matchQuery = { ownerId, status: 'completed' };

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate);
      if (endDate) matchQuery.date.$lte = new Date(endDate);
    }

    const report = await Sale.aggregate([
      { $match: matchQuery },
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
          salesCount: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalCost: { $sum: '$totalCost' },
          totalProfit: { $sum: '$profit' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    return report;
  }

  async getProfitLossReport(ownerId, filters = {}) {
    const { startDate, endDate, branchId } = filters;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const salesMatchQuery = { ownerId, status: 'completed' };
    const expenseMatchQuery = {};

    if (branchId) {
      salesMatchQuery.branchId = new mongoose.Types.ObjectId(branchId);
      expenseMatchQuery.branchId = new mongoose.Types.ObjectId(branchId);
    }

    if (startDate || endDate) {
      salesMatchQuery.date = dateFilter;
      expenseMatchQuery.date = dateFilter;
    }

    if (ownerId) {
      expenseMatchQuery.$or = [
        { ownerId },
        { isShared: true }
      ];
    }

    const [salesData, expenseData] = await Promise.all([
      Sale.aggregate([
        { $match: salesMatchQuery },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            totalCost: { $sum: '$totalCost' },
            grossProfit: { $sum: '$profit' }
          }
        }
      ]),
      Expense.aggregate([
        { $match: expenseMatchQuery },
        {
          $group: {
            _id: '$category',
            amount: { $sum: '$amount' }
          }
        }
      ])
    ]);

    const sales = salesData[0] || { totalRevenue: 0, totalCost: 0, grossProfit: 0 };
    const totalExpenses = expenseData.reduce((sum, exp) => sum + exp.amount, 0);
    const netProfit = sales.grossProfit - totalExpenses;

    return {
      revenue: sales.totalRevenue,
      costOfGoods: sales.totalCost,
      grossProfit: sales.grossProfit,
      expenses: {
        byCategory: expenseData,
        total: totalExpenses
      },
      netProfit,
      profitMargin: sales.totalRevenue > 0 
        ? ((netProfit / sales.totalRevenue) * 100).toFixed(2) 
        : 0
    };
  }
}

module.exports = new ReportService();
