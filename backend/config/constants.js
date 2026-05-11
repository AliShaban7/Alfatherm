module.exports = {
  // User Roles
  ROLES: {
    SUPER_OWNER: 'SUPER_OWNER',
    OWNER: 'OWNER',
    EMPLOYEE: 'EMPLOYEE'
  },

  // Pre-defined Super Owners (Zaur & Adalat)
  SUPER_OWNERS: ['owner_zaur_001', 'owner_adalat_002'],

  // Customer Types
  CUSTOMER_TYPES: {
    PHYSICAL: 'physical',
    LEGAL: 'legal',
    MASTER: 'master'
  },

  // Product Categories
  PRODUCT_CATEGORIES: {
    ELECTRIC: 'Elektrik',
    HEATING: 'İsidici',
    BATHROOM: 'Hamam',
    GENERAL: 'Ümumi'
  },

  // Product Units
  PRODUCT_UNITS: {
    PIECE: 'eded',
    METER: 'metr',
    SQUARE_METER: 'm2',
    CUBIC_METER: 'm3',
    KG: 'kg',
    LITER: 'litr',
    SET: 'dəst',
    BOX: 'qutu'
  },

  // Payment Types
  PAYMENT_TYPES: {
    PREPAID: 'prepaid',
    CREDIT: 'credit'
  },

  // Payment Methods (for prepaid)
  PAYMENT_METHODS: {
    CASH: 'cash',
    POS: 'pos',
    BANK: 'bank'
  },

  // Inventory Transaction Types
  INVENTORY_TRANSACTION_TYPES: {
    IN: 'IN',
    TRANSFER: 'TRANSFER',
    SALE: 'SALE',
    RETURN: 'RETURN',
    ADJUSTMENT: 'ADJUSTMENT'
  },

  // Warehouse Types
  WAREHOUSE_TYPES: {
    MAIN: 'main',
    BRANCH: 'branch'
  },

  // Expense Categories
  EXPENSE_CATEGORIES: {
    RENT: 'rent',
    SALARY: 'salary',
    LOGISTICS: 'logistics',
    UTILITIES: 'utilities',
    MAINTENANCE: 'maintenance',
    MARKETING: 'marketing',
    OTHER: 'other'
  },

  // Debtor/Creditor Status
  DEBT_STATUS: {
    PENDING: 'pending',
    PARTIAL: 'partial',
    PAID: 'paid',
    OVERDUE: 'overdue'
  }
};
