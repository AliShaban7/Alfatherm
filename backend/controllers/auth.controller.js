const authService = require('../services/auth.service');

exports.getUsers = async (req, res, next) => {
  try {
    const users = await authService.getUsers();
    res.json({ success: true, data: users });
  } catch (error) { next(error); }
};

exports.getUsernames = async (req, res, next) => {
  try {
    const data = await authService.searchUsernames(req.query.q);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

exports.updateUser = async (req, res, next) => {
  try {
    const user = await authService.updateUser(req.params.id, req.body);
    res.json({ success: true, data: user });
  } catch (error) { next(error); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const result = await authService.resetPassword(req.params.id, req.body.newPassword);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const result = await authService.deleteUser(req.params.id, req.user._id);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

exports.register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const user = await authService.getProfile(req.user._id);
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user._id, currentPassword, newPassword);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
