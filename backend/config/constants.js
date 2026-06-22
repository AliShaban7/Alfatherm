module.exports = {
  // User Roles
  ROLES: {
    SUPER_OWNER: 'SUPER_OWNER',
    OWNER: 'OWNER',
    EMPLOYEE: 'EMPLOYEE'
  },

  // Business owner IDs (Zaur & Ədalət — each owns their own data)
  OWNER_IDS: {
    ZAUR: 'owner_zaur_001',
    ADALAT: 'owner_adalat_002',
    ADMIN: 'owner_admin_000'
  },

  // Customer Types
  CUSTOMER_TYPES: {
    PHYSICAL: 'physical',
    LEGAL: 'legal',
    MASTER: 'master'
  },

  // Product Categories
  PRODUCT_CATEGORIES: {
    ELECTRIC: 'electric',
    HEATING: 'heating',
    BATHROOM: 'bathroom',
    GENERAL: 'general'
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
    DELIVERY: 'delivery',
    INSTALLATION: 'installation',
    COURIER: 'courier', // legacy
    PACKAGING: 'packaging', // legacy
    OTHER: 'other'
  },

  // Categories selectable as per-sale expenses at checkout (split between owners
  // by item share). Commission is NOT here — it has its own payable ledger.
  SALE_EXPENSE_CATEGORIES: ['delivery', 'installation', 'other'],

  // Debtor/Creditor Status
  DEBT_STATUS: {
    PENDING: 'pending',
    PARTIAL: 'partial',
    PAID: 'paid',
    OVERDUE: 'overdue'
  }
};
