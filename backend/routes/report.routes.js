const express = require('express');
const router = express.Router();
const { reportController } = require('../controllers');
const { protect, ownerOrAccountant, canSeeCostPrice, ownerDataIsolation, employeeRestricted } = require('../middleware/auth');

router.use(protect);
router.use(ownerDataIsolation);
router.use(canSeeCostPrice);
router.use(employeeRestricted); // Block all employees from accessing any reports

router.get('/dashboard', reportController.getDashboard);

router.get('/period-stats', reportController.getPeriodStats);

router.get('/sales', reportController.getSalesReport);

router.get('/products', reportController.getProductSalesReport);

router.get('/inventory', reportController.getInventoryReport);

router.get('/branches', ownerOrAccountant, reportController.getBranchReport);

router.get('/salespersons', reportController.getSalespersonReport);

router.get('/profit-loss', ownerOrAccountant, reportController.getProfitLossReport);

module.exports = router;
