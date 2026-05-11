import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/profile'),
  changePassword: (data) => api.put('/auth/change-password', data)
};

export const productAPI = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  getWithStock: (id) => api.get(`/products/${id}/stock`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`)
};

export const inventoryAPI = {
  getAll: () => api.get('/inventory'),
  getByWarehouse: (warehouseId) => api.get(`/inventory/warehouse/${warehouseId}`),
  getTransactions: (params) => api.get('/inventory/transactions', { params }),
  productEntry: (data) => api.post('/inventory/entry', data),
  transfer: (data) => api.post('/inventory/transfer', data),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  delete: (id) => api.delete(`/inventory/${id}`)
};

export const saleAPI = {
  getAll: (params) => api.get('/sales', { params }),
  getById: (id) => api.get(`/sales/${id}`),
  create: (data) => api.post('/sales', data),
  cancel: (id) => api.put(`/sales/${id}/cancel`),
  getDailySummary: (params) => api.get('/sales/daily-summary', { params })
};

export const customerAPI = {
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  getHistory: (id) => api.get(`/customers/${id}/history`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`)
};

export const debtorAPI = {
  getAll: (params) => api.get('/debtors', { params }),
  getById: (id) => api.get(`/debtors/${id}`),
  getSummary: (params) => api.get('/debtors/summary', { params }),
  getOverdue: () => api.get('/debtors/overdue'),
  addPayment: (id, data) => api.post(`/debtors/${id}/payment`, data)
};

export const vendorAPI = {
  getAll: (params) => api.get('/vendors', { params }),
  getById: (id) => api.get(`/vendors/${id}`),
  create: (data) => api.post('/vendors', data),
  update: (id, data) => api.put(`/vendors/${id}`, data),
  delete: (id) => api.delete(`/vendors/${id}`)
};

export const creditorAPI = {
  getAll: (params) => api.get('/creditors', { params }),
  getById: (id) => api.get(`/creditors/${id}`),
  getSummary: () => api.get('/creditors/summary'),
  create: (data) => api.post('/creditors', data),
  addPayment: (id, data) => api.post(`/creditors/${id}/payment`, data)
};

export const expenseAPI = {
  getAll: (params) => api.get('/expenses', { params }),
  getById: (id) => api.get(`/expenses/${id}`),
  getSummaryByCategory: (params) => api.get('/expenses/summary/category', { params }),
  getMonthlySummary: (params) => api.get('/expenses/summary/monthly', { params }),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`)
};

export const reportAPI = {
  getDashboard: (params) => api.get('/reports/dashboard', { params }),
  getSalesReport: (params) => api.get('/reports/sales', { params }),
  getProductSalesReport: (params) => api.get('/reports/products', { params }),
  getInventoryReport: () => api.get('/reports/inventory'),
  getBranchReport: (params) => api.get('/reports/branches', { params }),
  getProfitLossReport: (params) => api.get('/reports/profit-loss', { params })
};

export const branchAPI = {
  getAll: (params) => api.get('/branches', { params }),
  getById: (id) => api.get(`/branches/${id}`),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
  delete: (id) => api.delete(`/branches/${id}`)
};

export const warehouseAPI = {
  getAll: (params) => api.get('/warehouses', { params }),
  getById: (id) => api.get(`/warehouses/${id}`),
  getMain: () => api.get('/warehouses/main'),
  create: (data) => api.post('/warehouses', data),
  update: (id, data) => api.put(`/warehouses/${id}`, data),
  delete: (id) => api.delete(`/warehouses/${id}`)
};

export const categoryAPI = {
  getAll: (params) => api.get('/categories', { params }),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`)
};

export default api;
