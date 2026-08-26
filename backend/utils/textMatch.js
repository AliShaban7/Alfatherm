// Case-insensitive exact-match helpers for the name-uniqueness guards
// (products, ustas, salespersons, vendors, customers).
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Mongo filter matching `value` exactly, ignoring case and surrounding space.
// NOTE: a case-insensitive $regex cannot use a plain index, so these probes are
// scans. Fine at the current collection sizes; if they grow, store a lowercase
// key field and put a partial unique index on it instead.
const exactCI = (value) => ({
  $regex: `^${escapeRegex(String(value ?? '').trim())}$`,
  $options: 'i'
});

module.exports = { escapeRegex, exactCI };
