const Customer = require('../models/Customer');

class CustomerService {
  async create(customerData, ownerId, userId) {
    if (customerData.voen) {
      const existingCustomer = await Customer.findOne({ voen: customerData.voen });
      if (existingCustomer) {
        throw new Error('Bu VÖEN artıq sistemdə mövcuddur');
      }
    }

    const customer = await Customer.create({
      ...customerData,
      ownerId,
      createdBy: userId
    });

    return customer;
  }

  async getAll(ownerId, filters = {}, user = null) {
    const query = { isActive: true };
    
    if (user?.role !== 'salesperson') {
      query.ownerId = ownerId;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { phone: { $regex: filters.search, $options: 'i' } },
        { voen: { $regex: filters.search, $options: 'i' } }
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
    const customer = await Customer.findOne({ _id: id, ownerId });

    if (!customer) {
      throw new Error('Müştəri tapılmadı');
    }

    return customer;
  }

  async update(id, updateData, ownerId) {
    if (updateData.voen) {
      const existingCustomer = await Customer.findOne({ 
        voen: updateData.voen,
        _id: { $ne: id }
      });
      if (existingCustomer) {
        throw new Error('Bu VÖEN artıq sistemdə mövcuddur');
      }
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: id, ownerId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!customer) {
      throw new Error('Müştəri tapılmadı');
    }

    return customer;
  }

  async delete(id, ownerId) {
    const customer = await Customer.findOne({ _id: id, ownerId });

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

  async getCustomerHistory(id, ownerId) {
    const Sale = require('../models/Sale');
    const Debtor = require('../models/Debtor');

    const customer = await Customer.findOne({ _id: id, ownerId });
    if (!customer) {
      throw new Error('Müştəri tapılmadı');
    }

    const [sales, debts] = await Promise.all([
      Sale.find({ customerId: id, ownerId })
        .sort({ date: -1 })
        .limit(50)
        .lean(),
      Debtor.find({ customerId: id, ownerId })
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
