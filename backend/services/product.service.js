const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const Vendor = require('../models/Vendor');
const Counter = require('../models/Counter');
const { ROLES, OWNER_IDS } = require('../config/constants');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s) => String(s || '').trim().toLowerCase();

// Excel import maps: accept either the code/value or the Azerbaijani label.
// (Categories are resolved dynamically from the Category collection at import.)
const UNIT_IMPORT = {
  eded: 'eded', 'ədəd': 'eded', metr: 'metr', 'm2': 'm2', 'm²': 'm2',
  'm3': 'm3', 'm³': 'm3', kg: 'kg', kq: 'kg', litr: 'litr',
  'dəst': 'dəst', dest: 'dəst', qutu: 'qutu'
};
const OWNER_IMPORT = {
  zaur: OWNER_IDS.ZAUR,
  'ədalət': OWNER_IDS.ADALAT, 'adalət': OWNER_IDS.ADALAT, adalat: OWNER_IDS.ADALAT
};
// Short single-letter SKU prefix, same as Product.generateSKU (e.g. Z, A, S).
const skuCode = (ownerId) => Product.skuLetter(ownerId);

// Trim the descriptive free-text fields so " Bosch" and "Bosch" don't become
// distinct values. (The UI feeds these from a pick-or-add-new list, so the
// values should already be canonical; this is a safety net.)
const CANON_FIELDS = ['brand', 'manufacturer', 'country', 'color'];
const trimDescriptiveFields = (data) => {
  for (const f of CANON_FIELDS) {
    if (typeof data[f] === 'string') data[f] = data[f].trim();
  }
};

class ProductService {
  // The uniqueness key is (ownerId, name, vendorId): the same name may repeat as
  // long as it belongs to a DIFFERENT İstehsalçı (vendor). Same name + same
  // vendor stays blocked, and so does same name with NO vendor on both sides —
  // those two rows are indistinguishable in every product picker.
  // `excludeId` skips the product itself on update.
  async assertUniqueName(name, ownerId, vendorId = null, excludeId = null) {
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      throw new Error('Məhsul adı daxil edin');
    }
    const query = {
      ownerId,
      isActive: true,
      name: { $regex: `^${escapeRegex(trimmed)}$`, $options: 'i' },
      // null matches both an explicit null and a missing field (products with no
      // İstehsalçı). Never pass '' — Mongoose throws a CastError on ''→ObjectId.
      vendorId: vendorId || null
    };
    if (excludeId) query._id = { $ne: excludeId };
    if (await Product.findOne(query)) {
      throw new Error(vendorId
        ? 'Bu istehsalçıda bu adda məhsul artıq mövcuddur'
        : 'İstehsalçısız bu adda məhsul artıq mövcuddur');
    }
    return trimmed;
  }

  // Distinct existing values for the pick-or-add-new fields, so the New Product
  // form can offer them. Global (these attributes aren't owner-sensitive) and
  // de-duplicated case-insensitively to one canonical spelling each.
  async getFieldOptions() {
    const result = {};
    for (const field of CANON_FIELDS) {
      const values = await Product.distinct(field, { [field]: { $nin: [null, ''] } });
      const seen = new Map(); // lowercase -> first spelling
      for (const v of values) {
        const key = String(v).trim().toLowerCase();
        if (key && !seen.has(key)) seen.set(key, String(v).trim());
      }
      result[field] = [...seen.values()].sort((a, b) => a.localeCompare(b, 'az'));
    }
    return result; // { brand: [...], manufacturer: [...], country: [...], color: [...] }
  }

  async create(productData, ownerId, userId) {
    // A cleared <select> sends '' — that means "no vendor", not an ObjectId.
    if (!productData.vendorId) delete productData.vendorId;
    // An unknown vendorId would mint its own uniqueness bucket and bypass the
    // duplicate rule, so verify it points at a real, active vendor.
    if (productData.vendorId
        && !(await Vendor.exists({ _id: productData.vendorId, isActive: true }))) {
      throw new Error('Vendor tapılmadı');
    }

    // Reject a duplicate (ad + İstehsalçı) pair up front; normalize the fields.
    productData.name = await this.assertUniqueName(
      productData.name,
      ownerId,
      productData.vendorId || null
    );
    trimDescriptiveFields(productData);

    // Auto-generate SKU if not provided
    let sku = productData.sku;
    if (!sku) {
      sku = await Product.generateSKU(ownerId);
    } else {
      sku = sku.toUpperCase();
      // SKU is globally unique, so check across all owners — otherwise a clash
      // with the other owner's SKU would surface as a raw DB error on save.
      const existingProduct = await Product.findOne({ sku });
      if (existingProduct) {
        throw new Error('Bu SKU ilə məhsul artıq mövcuddur');
      }
    }

    // Set default costPrice if not provided
    const costPrice = productData.costPrice || 0;

    // Min price must cover cost — otherwise employees could sell at a loss,
    // which is exactly what min-price protection exists to prevent. (Mirrors
    // the same guard in update().)
    if (productData.minPrice !== undefined && productData.minPrice < costPrice) {
      throw new Error('Minimum qiymət maya dəyərindən az ola bilməz');
    }

    const product = await Product.create({
      ...productData,
      sku,
      costPrice,
      ownerId,
      createdBy: userId
    });

    return product;
  }

  // Bulk-create products from an Excel import. `rows` are normalized objects:
  // { name, category, unit, brand, manufacturer, country, color, costPrice,
  //   minPrice, recommendedPrice, description, owner }. Validates each row,
  // maps category/unit/vendor/owner, reserves SKUs in bulk, then insertMany.
  // Returns { created, failed, errors:[{row,name,error}] }.
  async importProducts(rows, user, defaultOwnerId) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('İdxal üçün məlumat yoxdur');
    }
    if (rows.length > 5000) {
      throw new Error('Bir dəfəyə maksimum 5000 sətir idxal edilə bilər');
    }

    const isSuper = user.role === ROLES.SUPER_OWNER;

    const Category = require('../models/Category');
    const [vendors, existing, categories] = await Promise.all([
      Vendor.find({}, 'name companyName').lean(),
      Product.find({ isActive: true }, 'name ownerId vendorId').lean(),
      Category.find({ type: 'product' }, 'name code').lean()
    ]);
    // İstehsalçı matches a vendor by its company name (Şirkət) or its name.
    const vendorByName = new Map();
    for (const v of vendors) {
      if (v.companyName) vendorByName.set(norm(v.companyName), v._id);
      if (v.name) vendorByName.set(norm(v.name), v._id);
    }
    // Category matches by its name or its code (from the Category collection).
    const categoryByLabel = new Map();
    for (const c of categories) {
      categoryByLabel.set(norm(c.name), c.code);
      categoryByLabel.set(norm(c.code), c.code);
    }
    // Duplicate key = owner + name + İstehsalçı; '' is the "no vendor" bucket, so
    // two vendorless rows with the same name still collide.
    const dupKey = (oid, nm, vid) => `${oid}|${norm(nm)}|${vid ? String(vid) : ''}`;
    const existingKey = new Set(existing.map((p) => dupKey(p.ownerId, p.name, p.vendorId)));

    const valid = [];
    const errors = [];
    const seen = new Set();

    rows.forEach((r, i) => {
      const rowNum = i + 2; // +1 header, +1 to 1-base
      const fail = (error) => errors.push({ row: rowNum, name: r.name || '', error });

      const name = String(r.name || '').trim();
      if (!name) return fail('Ad boşdur');

      let ownerId = defaultOwnerId;
      if (isSuper) {
        ownerId = OWNER_IMPORT[norm(r.owner)];
        if (!ownerId) return fail('Sahib tapılmadı (Zaur və ya Ədalət yazın)');
      }

      let category = 'general';
      if (r.category) {
        category = categoryByLabel.get(norm(r.category));
        if (!category) return fail(`Kateqoriya yanlışdır: "${r.category}"`);
      }
      let unit = 'eded';
      if (r.unit) {
        unit = UNIT_IMPORT[norm(r.unit)];
        if (!unit) return fail(`Vahid yanlışdır: "${r.unit}"`);
      }

      const costPrice = Number(r.costPrice) || 0;
      const minPrice = Number(r.minPrice);
      const recommendedPrice = Number(r.recommendedPrice);
      if (!Number.isFinite(minPrice)) return fail('Min qiymət yanlışdır');
      if (!Number.isFinite(recommendedPrice)) return fail('Tövsiyə qiymət yanlışdır');
      if (minPrice < costPrice) return fail('Min qiymət maya dəyərindən az ola bilməz');
      if (recommendedPrice < minPrice) return fail('Tövsiyə qiymət min qiymətdən az ola bilməz');

      // İstehsalçı → vendor by name (optional; unmatched just leaves it empty).
      const vendorId = r.manufacturer ? vendorByName.get(norm(r.manufacturer)) : undefined;

      // Same name is fine under a different İstehsalçı; same name + same vendor
      // (or both without one) is a duplicate. Checked here, not earlier, because
      // the vendor is only known at this point.
      const key = dupKey(ownerId, name, vendorId);
      if (seen.has(key) || existingKey.has(key)) {
        return fail(vendorId
          ? 'Bu istehsalçıda bu adda məhsul artıq mövcuddur'
          : 'İstehsalçısız bu adda məhsul artıq mövcuddur');
      }

      valid.push({
        name,
        brand: (r.brand || '').trim() || undefined,
        country: (r.country || '').trim() || undefined,
        color: (r.color || '').trim() || undefined,
        description: (r.description || '').trim() || undefined,
        category,
        unit,
        costPrice,
        minPrice,
        recommendedPrice,
        vendorId,
        ownerId,
        createdBy: user._id
      });
      seen.add(key);
    });

    // Reserve a block of SKU numbers per owner-code (one counter bump each),
    // then assign sequentially — avoids a DB round-trip per product.
    const byCode = {};
    for (const d of valid) {
      const code = skuCode(d.ownerId);
      (byCode[code] = byCode[code] || []).push(d);
    }
    for (const [code, docs] of Object.entries(byCode)) {
      const prefix = code; // single letter, e.g. Z / A / S
      const counter = await Counter.findByIdAndUpdate(
        `sku:${prefix}`,
        { $inc: { seq: docs.length } },
        { new: true, upsert: true }
      );
      let seq = counter.seq - docs.length;
      for (const d of docs) {
        seq += 1;
        d.sku = `${prefix}-${String(seq).padStart(4, '0')}`;
      }
    }

    let created = 0;
    if (valid.length) {
      // ordered:false → keep going past any individual row that still fails
      // (e.g. a rare SKU/barcode clash); collect those as errors.
      try {
        const inserted = await Product.insertMany(valid, { ordered: false });
        created = inserted.length;
      } catch (err) {
        created = err.insertedDocs?.length || 0;
        (err.writeErrors || []).forEach((we) => {
          errors.push({ row: '-', name: valid[we.index]?.name || '', error: 'Baza xətası (təkrar?)' });
        });
      }
    }

    return { created, failed: errors.length, errors: errors.slice(0, 300) };
  }

  async getAll(ownerId, filters = {}, canSeeCostPrice = false, user = null) {
    const query = { isActive: true };

    // ownOnly=true forces the caller's own namespace even for employees/super
    // owner — used by the salesperson stocking screen, where you can only add
    // stock to your own (store) products. Otherwise employees/super owner see all.
    if (filters.ownOnly === 'true' || (user?.role !== ROLES.SUPER_OWNER && user?.role !== ROLES.EMPLOYEE)) {
      query.ownerId = ownerId;
    }

    if (filters.category) {
      query.category = filters.category;
    }

    // Exact-match filters (values come from the canonical option dropdowns).
    if (filters.brand) {
      query.brand = filters.brand;
    }

    // İstehsalçı is the linked vendor (by id).
    if (filters.vendorId) {
      query.vendorId = filters.vendorId;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { sku: { $regex: filters.search, $options: 'i' } },
        { brand: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const skip = (page - 1) * limit;

    let selectFields = '-__v';
    if (!canSeeCostPrice) {
      selectFields += ' -costPrice';
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .select(selectFields)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query)
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Owner filter for a single-resource lookup. Super owner (director) and, for
  // read paths, employees may act on any owner's products; founders are scoped.
  _ownerScope(ownerId, user, allowEmployee = false) {
    if (user?.role === ROLES.SUPER_OWNER) return {};
    if (allowEmployee && user?.role === ROLES.EMPLOYEE) return {};
    return { ownerId };
  }

  async getById(id, ownerId, canSeeCostPrice = false, user = null) {
    const product = await Product.findOne({ _id: id, ...this._ownerScope(ownerId, user, true) });

    if (!product) {
      throw new Error('Məhsul tapılmadı');
    }

    if (!canSeeCostPrice) {
      return product.toEmployeeJSON();
    }

    return product;
  }

  async update(id, updateData, ownerId, canSeeCostPrice = false, user = null) {
    if (!canSeeCostPrice) {
      delete updateData.costPrice;
    }

    const scope = this._ownerScope(ownerId, user);

    // A product's owner must never change via an update.
    delete updateData.ownerId;

    // Fetch existing product to validate price relationships
    const existingProduct = await Product.findOne({ _id: id, ...scope });
    if (!existingProduct) {
      throw new Error('Məhsul tapılmadı');
    }

    // '' from a cleared İstehsalçı <select> means "no vendor"; keep it out of the
    // ObjectId path (Mongoose cannot cast '' to an ObjectId).
    if (updateData.vendorId === '') updateData.vendorId = null;
    if (updateData.vendorId
        && !(await Vendor.exists({ _id: updateData.vendorId, isActive: true }))) {
      throw new Error('Vendor tapılmadı');
    }

    // The key is (ownerId, name, vendorId), so a vendor-only change can create a
    // collision exactly like a rename can — re-check on either.
    if (updateData.name !== undefined || updateData.vendorId !== undefined) {
      const finalName = updateData.name !== undefined ? updateData.name : existingProduct.name;
      const finalVendorId = updateData.vendorId !== undefined
        ? updateData.vendorId
        : existingProduct.vendorId;
      const checkedName = await this.assertUniqueName(
        finalName,
        existingProduct.ownerId,
        finalVendorId || null,
        id
      );
      if (updateData.name !== undefined) updateData.name = checkedName;
    }
    trimDescriptiveFields(updateData);

    // Get the final values (use updateData if provided, otherwise use existing)
    const finalMinPrice = updateData.minPrice !== undefined ? updateData.minPrice : existingProduct.minPrice;
    const finalRecommendedPrice = updateData.recommendedPrice !== undefined ? updateData.recommendedPrice : existingProduct.recommendedPrice;
    const finalCostPrice = updateData.costPrice !== undefined ? updateData.costPrice : existingProduct.costPrice;

    // Validate price relationships with final values
    if (finalMinPrice < finalCostPrice) {
      throw new Error('Minimum qiymət maya dəyərindən az ola bilməz');
    }

    if (finalRecommendedPrice < finalMinPrice) {
      throw new Error('Tövsiyə olunan qiymət minimum qiymətdən az ola bilməz');
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, ...scope },
      updateData,
      { new: true, runValidators: false }  // Disable validators since we're doing manual validation
    );

    if (!product) {
      throw new Error('Məhsul tapılmadı');
    }

    return canSeeCostPrice ? product : product.toEmployeeJSON();
  }

  async delete(id, ownerId, user = null) {
    // Block deletion if any warehouse still holds stock of this product
    // (scoped to the product's owner via the stock rows themselves).
    const inventory = await Inventory.findOne({
      productId: id,
      quantity: { $gt: 0 }
    });

    if (inventory) {
      throw new Error('Stokda olan məhsul silinə bilməz');
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, ...this._ownerScope(ownerId, user) },
      { isActive: false },
      { new: true }
    );

    if (!product) {
      throw new Error('Məhsul tapılmadı');
    }

    return { message: 'Məhsul uğurla silindi' };
  }

  async getProductWithStock(id, ownerId, canSeeCostPrice = false, user = null) {
    const product = await Product.findOne({ _id: id, ...this._ownerScope(ownerId, user, true) }).lean();

    if (!product) {
      throw new Error('Məhsul tapılmadı');
    }

    // Stock rows belong to the product's owner; match the product, not the viewer.
    const inventory = await Inventory.find({ productId: id, ownerId: product.ownerId })
      .populate('warehouseId', 'name code type')
      .lean();

    const totalStock = inventory.reduce((sum, inv) => sum + inv.quantity, 0);

    if (!canSeeCostPrice) {
      delete product.costPrice;
    }

    return {
      ...product,
      totalStock,
      stockByWarehouse: inventory.map(inv => ({
        warehouse: inv.warehouseId,
        quantity: inv.quantity
      }))
    };
  }
}

module.exports = new ProductService();
