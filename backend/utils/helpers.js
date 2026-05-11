exports.formatCurrency = (amount, currency = 'AZN') => {
  return `${amount.toFixed(2)} ${currency}`;
};

exports.generateCode = (prefix, length = 6) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = prefix ? `${prefix}-` : '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

exports.paginateResults = (page = 1, limit = 50) => {
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;
  
  return {
    page: pageNum,
    limit: limitNum,
    skip
  };
};

exports.buildDateFilter = (startDate, endDate) => {
  const filter = {};
  
  if (startDate) {
    filter.$gte = new Date(startDate);
  }
  
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filter.$lte = end;
  }
  
  return Object.keys(filter).length > 0 ? filter : null;
};

exports.calculateProfit = (salePrice, costPrice, quantity) => {
  return (salePrice - costPrice) * quantity;
};

exports.calculateProfitMargin = (profit, revenue) => {
  if (revenue === 0) return 0;
  return ((profit / revenue) * 100).toFixed(2);
};
