const ustaService = require('../services/usta.service');
const commissionService = require('../services/commission.service');
const { ROLES } = require('../config/constants');

exports.create = async (req, res, next) => {
  try {
    const usta = await ustaService.create(req.body, req.user._id);
    res.status(201).json({ success: true, data: usta });
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const ustas = await ustaService.getAll(req.query);
    res.status(200).json({ success: true, data: ustas });
  } catch (error) {
    next(error);
  }
};

exports.getBalances = async (req, res, next) => {
  try {
    const balances = await ustaService.getBalances(req.user);
    res.status(200).json({ success: true, data: balances });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const usta = await ustaService.getById(req.params.id);
    res.status(200).json({ success: true, data: usta });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const usta = await ustaService.update(req.params.id, req.body);
    res.status(200).json({ success: true, data: usta });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const result = await ustaService.delete(req.params.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.pay = async (req, res, next) => {
  try {
    const { amount, paymentMethod, note } = req.body;
    // An owner settles their own balance; the super owner must say which owner's
    // share they're paying (balances are tracked per owner).
    const ownerId = req.user.role === ROLES.OWNER ? req.ownerId : req.body.ownerId;

    const result = await commissionService.payUsta(
      req.params.id,
      ownerId,
      amount,
      paymentMethod,
      req.user._id,
      note
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
