const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/products', require('./product.routes'));
router.use('/inventory', require('./inventory.routes'));
router.use('/sales', require('./sale.routes'));
router.use('/customers', require('./customer.routes'));
router.use('/debtors', require('./debtor.routes'));
router.use('/vendors', require('./vendor.routes'));
router.use('/creditors', require('./creditor.routes'));
router.use('/expenses', require('./expense.routes'));
router.use('/reports', require('./report.routes'));
router.use('/branches', require('./branch.routes'));
router.use('/warehouses', require('./warehouse.routes'));
router.use('/categories', require('./category.routes'));

module.exports = router;
