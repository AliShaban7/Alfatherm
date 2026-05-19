import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000 // 15 second timeout
});

// Simple in-memory cache for GET requests
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

const getCacheKey = (config) => `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`;

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Check cache for GET requests (skip for auth routes)
    if (config.method === 'get' && !config.url.includes('/auth/')) {
      const cacheKey = getCacheKey(config);
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        config.adapter = () => Promise.resolve({
          data: cached.data,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {}
        });
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    // Cache successful GET responses (skip auth routes)
    if (response.config.method === 'get' && !response.config.url.includes('/auth/')) {
      const cacheKey = getCacheKey(response.config);
      cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Export function to clear cache (call after mutations)
export const clearApiCache = () => cache.clear();

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
  create: (data) => api.post('/products', data).then(r => { clearApiCache(); return r; }),
  update: (id, data) => api.put(`/products/${id}`, data).then(r => { clearApiCache(); return r; }),
  delete: (id) => api.delete(`/products/${id}`).then(r => { clearApiCache(); return r; })
};

export const inventoryAPI = {
  getAll: () => api.get('/inventory'),
  getByWarehouse: (warehouseId) => api.get(`/inventory/warehouse/${warehouseId}`),
  getTransactions: (params) => api.get('/inventory/transactions', { params }),
  productEntry: (data) => api.post('/inventory/entry', data).then(r => { clearApiCache(); return r; }),
  transfer: (data) => api.post('/inventory/transfer', data).then(r => { clearApiCache(); return r; }),
  update: (id, data) => api.put(`/inventory/${id}`, data).then(r => { clearApiCache(); return r; }),
  delete: (id) => api.delete(`/inventory/${id}`).then(r => { clearApiCache(); return r; })
};

export const saleAPI = {
  getAll: (params) => api.get('/sales', { params }),
  getById: (id) => api.get(`/sales/${id}`),
  create: (data) => api.post('/sales', data).then(r => { clearApiCache(); return r; }),
  cancel: (id) => api.put(`/sales/${id}/cancel`).then(r => { clearApiCache(); return r; }),
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
  getPeriodStats: (params) => api.get('/reports/period-stats', { params }),
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
