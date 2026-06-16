const AZ_PHONE_PREFIX = '+994';

const normalizePhone = (value) => {
  if (!value || !/\d/.test(value)) return '';

  let digits = String(value).replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('994')) {
    digits = digits.slice(3);
  }
  while (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return `${AZ_PHONE_PREFIX}${digits.slice(0, 9)}`;
};

const normalizeVoen = (value) => {
  if (!value) return '';
  return String(value).trim();
};

const normalizeFin = (value) => {
  if (!value) return '';
  return String(value).trim().toUpperCase();
};

const prepareCustomerIdentityFields = (data) => {
  const prepared = { ...data };

  if (prepared.phone) {
    prepared.phone = normalizePhone(prepared.phone);
  }
  if (prepared.voen) {
    prepared.voen = normalizeVoen(prepared.voen);
  }
  if (prepared.fin) {
    prepared.fin = normalizeFin(prepared.fin);
  }

  return prepared;
};

module.exports = {
  normalizePhone,
  normalizeVoen,
  normalizeFin,
  prepareCustomerIdentityFields
};
