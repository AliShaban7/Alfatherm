const express = require('express');
const router = express.Router();
const { expenseController } = require('../controllers');
const { protect, ownerDataIsolation } = require('../middleware/auth');

router.use(protect);
router.use(ownerDataIsolation);

router.post('/', expenseController.create);

router.get('/', expenseController.getAll);

router.get('/summary/category', expenseController.getSummaryByCategory);

router.get('/summary/monthly', expenseController.getMonthlySummary);

router.get('/:id', expenseController.getById);

router.put('/:id', expenseController.update);

router.delete('/:id', expenseController.delete);

module.exports = router;
