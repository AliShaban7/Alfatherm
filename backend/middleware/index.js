module.exports = {
  ...require('./auth'),
  errorHandler: require('./errorHandler'),
  validateRequest: require('./validateRequest')
};
