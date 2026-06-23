const mongoose = require('mongoose');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const Warehouse = require('../models/Warehouse');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const Creditor = require('../models/Creditor');
const { INVENTORY_TRANSACTION_TYPES, WAREHOUSE_TYPES, ROLES } = require('../config/constants');

class PurchaseInvoiceService {
  // Create a purchase invoice: validate, update stock (weighted-average cost),
  // log an IN transaction per line, and turn any unpaid remainder into a single
  // linked Creditor (vendor debt). One payment status for the whole invoice.
  async create(data, ownerId, userId, canAccessMainWarehouse) {
    const {
      vendorId, warehouseId, items, vendorInvoiceNumber,
      paymentStatus, paidAmount, dueDate, note
    } = data;

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Ən azı bir məhsul əlavə edin');
    }

    const [warehouse, vendor] = await Promise.all([
      Warehouse.findById(warehouseId).lean(),
      Vendor.findById(vendorId) // vendors are shared across owners
    ]);

    if (!warehouse) {
      throw new Error('Anbar tapılmadı');
    }
    if (warehouse.type === WAREHOUSE_TYPES.MAIN && !canAccessMainWarehouse) {
      throw new Error('Əsas anbara giriş icazəniz yoxdur');
    }
    if (!vendor) {
      throw new Error('Vendor tapılmadı');
    }

    // Resolve + validate every product belongs to this owner.
    const productIds = items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds }, ownerId }).lean();
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const lineItems = items.map((item) => {
      const product = productMap.get(String(item.productId));
      if (!product) {
        throw new Error('Məhsul tapılmadı və ya bu sahibə aid deyil');
      }
      const quantity = Number(item.quantity);
      const costPrice = Number(item.costPrice);
      if (!Number.isFinite(quantity) || quantity < 1) {
        throw new Error(`"${product.name}" üçün düzgün miqdar daxil edin`);
      }
      if (!Number.isFinite(costPrice) || costPrice < 0) {
        throw new Error(`"${product.name}" üçün düzgün maya dəyəri daxil edin`);
      }
      return {
        productId: product._id,
        productName: product.name,
        quantity,
        costPrice,
        total: Math.round(quantity * costPrice * 100) / 100
      };
    });

    const totalAmount = Math.round(lineItems.reduce((sum, i) => sum + i.total, 0) * 100) / 100;

    // Resolve the up-front payment from the chosen status.
    let initialPaid = 0;
    if (paymentStatus === 'paid') {
      initialPaid = totalAmount;
    } else if (paymentStatus === 'partial') {
      initialPaid = Math.min(Math.max(Number(paidAmount) || 0, 0), totalAmount);
    }
    const remaining = Math.round((totalAmount - initialPaid) * 100) / 100;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const invoiceNumber = await PurchaseInvoice.generateInvoiceNumber();

      const created = await PurchaseInvoice.create([{
        invoiceNumber,
        vendorInvoiceNumber,
        ownerId,
        vendorId,
        vendorName: vendor.name,
        warehouseId,
        warehouseName: warehouse.name,
        items: lineItems,
        totalAmount,
        initialPaidAmount: initialPaid,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        note,
        createdBy: userId
      }], { session });
      const invoice = created[0];

      // Update stock (weighted-average cost) + log an IN movement per line.
      for (const line of lineItems) {
        const inv = await Inventory.findOne({
          productId: line.productId, warehouseId, ownerId
        }).session(session);

        if (inv) {
          const oldValue = inv.quantity * (inv.costPrice || 0);
          const addedValue = line.quantity * line.costPrice;
          const newQty = inv.quantity + line.quantity;
          inv.costPrice = newQty > 0 ? (oldValue + addedValue) / newQty : line.costPrice;
          inv.quantity = newQty;
          inv.lastUpdated = new Date();
          await inv.save({ session });
        } else {
          await Inventory.create([{
            productId: line.productId,
            warehouseId,
            ownerId,
            quantity: line.quantity,
            costPrice: line.costPrice
          }], { session });
        }

        await InventoryTransaction.create([{
          type: INVENTORY_TRANSACTION_TYPES.IN,
          productId: line.productId,
          ownerId,
          toWarehouseId: warehouseId,
          quantity: line.quantity,
          costPrice: line.costPrice,
          vendorId,
          purchaseInvoiceId: invoice._id,
          note: `Faktura ${invoiceNumber}`,
          createdBy: userId
        }], { session });
      }

      // Unpaid remainder → one Creditor (vendor debt), reusing the existing
      // creditor/payment machinery. vendor.totalDebt tracks the aggregate.
      if (remaining > 0) {
        const creditor = await Creditor.create([{
          ownerId,
          vendorId,
          purchaseInvoiceId: invoice._id,
          description: `Mal girişi - Faktura ${invoiceNumber}`,
          totalAmount,
          paidAmount: initialPaid,
          remainingAmount: remaining,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          createdBy: userId
        }], { session });

        invoice.creditorId = creditor[0]._id;
        await invoice.save({ session });
      }

      // Vendor stats.
      await Vendor.findByIdAndUpdate(vendorId, {
        $inc: { totalPurchases: totalAmount, totalDebt: remaining }
      }, { session });

      await session.commitTransaction();
      return invoice.toObject();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Bulk import purchase invoices from Excel. Each row is one product line;
  // rows sharing the same "Faktura No" merge into a single invoice. Resolves
  // vendor (by company/name), warehouse (by name) and products (by SKU/name),
  // then reuses create() per invoice so stock, creditors and vendor stats are
  // handled identically to manual entry. Returns a per-invoice summary.
  async importInvoices(rows, user, canAccessMainWarehouse) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('İdxal üçün məlumat yoxdur');
    }
    if (rows.length > 5000) {
      throw new Error('Bir dəfəyə maksimum 5000 sətir idxal edilə bilər');
    }
    const norm = (s) => String(s || '').trim().toLowerCase();
    const isSuper = user.role === ROLES.SUPER_OWNER;

    const [vendors, warehouses, products] = await Promise.all([
      Vendor.find({}, 'name companyName').lean(),
      Warehouse.find({ isActive: true }, 'name').lean(),
      Product.find({ isActive: true }, 'sku name ownerId').lean()
    ]);

    const vendorByName = new Map();
    vendors.forEach((v) => {
      if (v.companyName && !vendorByName.has(norm(v.companyName))) vendorByName.set(norm(v.companyName), v);
      if (v.name && !vendorByName.has(norm(v.name))) vendorByName.set(norm(v.name), v);
    });
    const whByName = new Map(warehouses.map((w) => [norm(w.name), w]));
    const prodBySku = new Map(products.map((p) => [String(p.sku).toUpperCase(), p]));
    const prodByName = new Map(products.map((p) => [norm(p.name), p]));

    const STATUS_MAP = {
      'ödənilib': 'paid', 'paid': 'paid',
      'qismən ödənilib': 'partial', 'qismən': 'partial', 'partial': 'partial',
      'borc': 'unpaid', 'ödənilməyib': 'unpaid', 'unpaid': 'unpaid'
    };

    // Group rows: same Faktura No → one invoice; blank Faktura No → its own row.
    const groups = new Map();
    rows.forEach((r, i) => {
      const faktura = String(r.faktura || '').trim();
      const key = faktura ? `f:${norm(faktura)}` : `row:${i}`;
      if (!groups.has(key)) groups.set(key, { faktura, rows: [] });
      groups.get(key).rows.push({ ...r, _row: i + 2 });
    });

    const errors = [];
    let created = 0;

    for (const g of groups.values()) {
      const head = g.rows[0];
      const groupLabel = g.faktura || `Sətir ${head._row}`;
      try {
        const vendor = vendorByName.get(norm(head.vendor));
        if (!vendor) throw new Error(`Vendor tapılmadı: "${head.vendor || ''}"`);
        const wh = whByName.get(norm(head.warehouse));
        if (!wh) throw new Error(`Anbar tapılmadı: "${head.warehouse || ''}"`);
        const paymentStatus = STATUS_MAP[norm(head.status)] || 'paid';

        const items = [];
        let ownerId = null;
        for (const row of g.rows) {
          let product = row.sku ? prodBySku.get(String(row.sku).trim().toUpperCase()) : null;
          if (!product && row.product) product = prodByName.get(norm(row.product));
          if (!product) throw new Error(`Sətir ${row._row}: məhsul tapılmadı`);
          if (!isSuper && product.ownerId !== user.ownerId) throw new Error(`Sətir ${row._row}: məhsul sizə aid deyil`);
          if (ownerId && ownerId !== product.ownerId) throw new Error('Bir fakturada məhsullar fərqli sahibə aiddir');
          ownerId = product.ownerId;

          const quantity = Number(row.quantity);
          const costPrice = Number(row.costPrice);
          if (!Number.isFinite(quantity) || quantity < 1) throw new Error(`Sətir ${row._row}: miqdar yanlışdır`);
          if (!Number.isFinite(costPrice) || costPrice < 0) throw new Error(`Sətir ${row._row}: maya dəyəri yanlışdır`);
          items.push({ productId: product._id, quantity, costPrice });
        }

        await this.create({
          vendorId: vendor._id,
          warehouseId: wh._id,
          items,
          vendorInvoiceNumber: g.faktura || undefined,
          paymentStatus,
          paidAmount: paymentStatus === 'partial' ? Number(head.paidAmount) || 0 : undefined,
          note: 'Excel ilə idxal'
        }, ownerId, user._id, isSuper ? true : canAccessMainWarehouse);
        created++;
      } catch (e) {
        errors.push({ faktura: groupLabel, error: e.message });
      }
    }

    return { created, failed: errors.length, errors: errors.slice(0, 300) };
  }

  async getAll(ownerFilter = {}, filters = {}) {
    const query = { ...ownerFilter };
    if (filters.vendorId) query.vendorId = filters.vendorId;
    if (filters.startDate || filters.endDate) {
      query.date = {};
      if (filters.startDate) query.date.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const page = parseInt(filters.page, 10) || 1;
    const limit = parseInt(filters.limit, 10) || 25;
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      PurchaseInvoice.find(query)
        .populate('vendorId', 'name companyName phone')
        .populate('creditorId', 'remainingAmount paidAmount status')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PurchaseInvoice.countDocuments(query)
    ]);

    // Surface live payment status from the linked creditor (or fully paid).
    const shaped = invoices.map((inv) => {
      const remainingAmount = inv.creditorId ? inv.creditorId.remainingAmount : 0;
      return {
        ...inv,
        remainingAmount,
        paymentStatus: remainingAmount <= 0 ? 'paid' : (inv.initialPaidAmount > 0 ? 'partial' : 'unpaid')
      };
    });

    return {
      invoices: shaped,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 }
    };
  }

  async getById(id, ownerFilter = {}) {
    const invoice = await PurchaseInvoice.findOne({ _id: id, ...ownerFilter })
      .populate('vendorId', 'name companyName phone address')
      .populate('warehouseId', 'name code')
      .populate({ path: 'creditorId', populate: { path: 'paymentHistory.paidBy', select: 'name' } })
      .lean();

    if (!invoice) {
      throw new Error('Faktura tapılmadı');
    }
    return invoice;
  }
}

module.exports = new PurchaseInvoiceService();
