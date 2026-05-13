const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Debtor = require('../models/Debtor');
const Branch = require('../models/Branch');
const inventoryService = require('./inventory.service');
const { PAYMENT_TYPES } = require('../config/constants');

class SaleService {
  async create(saleData, user) {
    const { customerId, warehouseId, items, paymentType, paymentMethod, isOfficial, paidAmount, note } = saleData;
    const ownerId = user.ownerId;
    const userId = user._id;
    const branchId = user.branchId;

    const customer = await Customer.findOne({ _id: customerId, ownerId });
    if (!customer) {
      throw new Error('Müştəri tapılmadı');
    }

    const branch = await Branch.findById(branchId);
    if (!branch) {
      throw new Error('Filial tapılmadı');
    }

    const processedItems = [];
    let subtotal = 0;
    let totalCost = 0;
    let totalDiscount = 0;

    for (const item of items) {
      const product = await Product.findOne({ _id: item.productId, ownerId });
      if (!product) {
        throw new Error(`Məhsul tapılmadı: ${item.productId}`);
      }

      if (item.unitPrice < product.minPrice) {
        throw new Error(`"${product.name}" üçün qiymət minimum qiymətdən (${product.minPrice} AZN) aşağı ola bilməz`);
      }

      const itemSubtotal = item.unitPrice * item.quantity;
      const itemCost = product.costPrice * item.quantity;
      
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
        costPrice: product.costPrice,
        discount: itemDiscount,
        total: itemTotal
      });

      subtotal += itemSubtotal;
      totalCost += itemCost;
      totalDiscount += itemDiscount;
    }

    const totalAmount = subtotal;
    const profit = totalAmount - totalCost;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const saleNumber = await Sale.generateSaleNumber(branch.code);

      const sale = await Sale.create([{
        saleNumber,
        ownerId,
        userId,
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

      for (const item of processedItems) {
        await inventoryService.deductForSale(
          item.productId,
          warehouseId,
          item.quantity,
          item.unitPrice,
          createdSale._id,
          ownerId,
          userId,
          session
        );
      }

      if (paymentType === PAYMENT_TYPES.CREDIT) {
        await Debtor.create([{
          ownerId,
          customerId,
          saleId: createdSale._id,
          branchId,
          totalAmount,
          paidAmount: paidAmount || 0,
          remainingAmount: totalAmount - (paidAmount || 0),
          createdBy: userId
        }], { session });

        await Customer.findByIdAndUpdate(customerId, {
          $inc: { 
            totalPurchases: totalAmount,
            totalDebt: totalAmount - (paidAmount || 0)
          }
        }, { session });
      } else {
        await Customer.findByIdAndUpdate(customerId, {
          $inc: { totalPurchases: totalAmount }
        }, { session });
      }

      await session.commitTransaction();

      return createdSale;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getAll(ownerId, filters = {}, canSeeCostPrice = false) {
    const query = { ownerId };

    if (filters.branchId) {
      query.branchId = filters.branchId;
    }

    if (filters.customerId) {
      query.customerId = filters.customerId;
    }

    if (filters.paymentType) {
      query.paymentType = filters.paymentType;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      query.date = {};
      if (filters.startDate) {
        query.date.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.date.$lte = new Date(filters.endDate);
      }
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const skip = (page - 1) * limit;

    let selectFields = '-__v';
    if (!canSeeCostPrice) {
      selectFields += ' -totalCost -profit -items.costPrice';
    }

    const [sales, total] = await Promise.all([
      Sale.find(query)
        .select(selectFields)
        .populate('customerId', 'name phone type')
        .populate('branchId', 'name code')
        .populate('userId', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Sale.countDocuments(query)
    ]);

    return {
      sales,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getById(id, ownerId, canSeeCostPrice = false) {
    let selectFields = '-__v';
    if (!canSeeCostPrice) {
      selectFields += ' -totalCost -profit -items.costPrice';
    }

    const sale = await Sale.findOne({ _id: id, ownerId })
      .select(selectFields)
      .populate('customerId', 'name phone type address voen')
      .populate('branchId', 'name code address')
      .populate('warehouseId', 'name code')
      .populate('userId', 'name email')
      .lean();

    if (!sale) {
      throw new Error('Satış tapılmadı');
    }

    return sale;
  }

  async cancel(id, ownerId, userId) {
    const sale = await Sale.findOne({ _id: id, ownerId });

    if (!sale) {
      throw new Error('Satış tapılmadı');
    }

    if (sale.status === 'cancelled') {
      throw new Error('Bu satış artıq ləğv edilib');
    }

    sale.status = 'cancelled';
    await sale.save();

    return sale;
  }

  async getDailySummary(ownerId, branchId, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const matchQuery = {
      ownerId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: 'completed'
    };

    if (branchId) {
      matchQuery.branchId = new mongoose.Types.ObjectId(branchId);
    }

    const summary = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalCost: { $sum: '$totalCost' },
          totalProfit: { $sum: '$profit' },
          cashSales: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$totalAmount', 0]
            }
          },
          posSales: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'pos'] }, '$totalAmount', 0]
            }
          },
          bankSales: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'bank'] }, '$totalAmount', 0]
            }
          },
          creditSales: {
            $sum: {
              $cond: [{ $eq: ['$paymentType', 'credit'] }, '$totalAmount', 0]
            }
          }
        }
      }
    ]);

    return summary[0] || {
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
