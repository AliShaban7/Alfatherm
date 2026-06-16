const express = require('express');
const router = express.Router();
const { branchController } = require('../controllers');
const { protect, ownerOnly } = require('../middleware/auth');

router.use(protect);

router.post('/', ownerOnly, branchController.create);

router.get('/', branchController.getAll);

router.get('/:id', branchController.getById);

router.put('/:id', ownerOnly, branchController.update);

router.delete('/:id', ownerOnly, branchController.delete);

module.exports = router;
