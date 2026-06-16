const Customer = require('../models/Customer');
const { ROLES } = require('../config/constants');
const { prepareCustomerIdentityFields } = require('../utils/customerIdentity');

class CustomerService {
  async assertUniqueIdentityFields(fields, excludeCustomerId = null) {
    const baseQuery = { isActive: true };
    if (excludeCustomerId) {
      baseQuery._id = { $ne: excludeCustomerId };
    }

    if (fields.phone) {
      const existing = await Customer.findOne({ ...baseQuery, phone: fields.phone });
      if (existing) {
        throw new Error('Bu telefon nömrəsi artıq sistemdə mövcuddur');
      }
    }

    if (fields.voen) {
      const existing = await Customer.findOne({ ...baseQuery, voen: fields.voen });
      if (existing) {
        throw new Error('Bu VÖEN artıq sistemdə mövcuddur');
      }
    }

    if (fields.fin) {
      const existing = await Customer.findOne({ ...baseQuery, fin: fields.fin });
      if (existing) {
        throw new Error('Bu FIN artıq sistemdə mövcuddur');
      }
    }
  }

  async create(customerData, ownerId, userId) {
    const prepared = prepareCustomerIdentityFields(customerData);

    await this.assertUniqueIdentityFields({
      phone: prepared.phone,
      voen: prepared.voen,
      fin: prepared.fin
    });

    const customer = await Customer.create({
      ...prepared,
      ownerId,
      createdBy: userId
    });

    return customer;
  }

  async getAll(ownerId, filters = {}, user = null) {
    // Customers are a shared pool across both owners (one physical store), so
    // everyone sees the same customer list regardless of role.
    const query = { isActive: true };

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { phone: { $regex: filters.search, $options: 'i' } },
        { voen: { $regex: filters.search, $options: 'i' } },
        { fin: { $regex: filters.search, $options: 'i' } }
      ];
    }

    if (filters.hasDebt === 'true') {
      query.totalDebt = { $gt: 0 };
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(query)
    ]);

    return {
      customers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getById(id, ownerId) {
    // Shared customer pool — looked up by id only, not scoped to an owner.
    const customer = await Customer.findOne({ _id: id, isActive: true });

    if (!customer) {
      throw new Error('Müştəri tapılmadı');
    }

    return customer;
  }

  async update(id, updateData, ownerId) {
    const prepared = prepareCustomerIdentityFields(updateData);

    await this.assertUniqueIdentityFields(
      {
        phone: prepared.phone,
        voen: prepared.voen,
        fin: prepared.fin
      },
      id
    );

    const customer = await Customer.findOneAndUpdate(
      { _id: id, isActive: true },
      prepared,
      { new: true, runValidators: true }
    );

    if (!customer) {
      throw new Error('Müştəri tapılmadı');
    }

    return customer;
  }

  async delete(id, ownerId) {
    const customer = await Customer.findOne({ _id: id, isActive: true });

    if (!customer) {
      throw new Error('Müştəri tapılmadı');
    }

    if (customer.totalDebt > 0) {
      throw new Error('Borcu olan müştəri silinə bilməz');
    }

    customer.isActive = false;
    await customer.save();

    return { message: 'Müştəri uğurla silindi' };
  }

  async getCustomerHistory(id, user) {
    const Sale = require('../models/Sale');
    const Debtor = require('../models/Debtor');

    const customer = await Customer.findOne({ _id: id, isActive: true });
    if (!customer) {
      throw new Error('Müştəri tapılmadı');
    }

    // The customer is shared, but each founder only sees their own transactions
    // with that customer; super owner / employees see the full history.
    const saleQuery = { customerId: id };
    const debtQuery = { customerId: id };
    if (user?.role === ROLES.OWNER) {
      saleQuery.ownerIds = user.ownerId;
      debtQuery.ownerId = user.ownerId;
    }

    const [sales, debts] = await Promise.all([
      Sale.find(saleQuery)
        .sort({ date: -1 })
        .limit(50)
        .lean(),
      Debtor.find(debtQuery)
        .sort({ createdAt: -1 })
        .lean()
    ]);

    return {
      customer,
      sales,
      debts
    };
  }
}

module.exports = new CustomerService();
