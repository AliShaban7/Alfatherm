const mongoose = require('mongoose');

/**
 * Atomic sequence counters. Each document is a named counter whose `seq` is
 * advanced with a single `$inc` (findOneAndUpdate + upsert), which MongoDB
 * applies atomically even under concurrent writers — so two cashiers billing at
 * the same time can never receive the same number.
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String }, // the counter key, e.g. "SAL-BR1-20260608"
  seq: { type: Number, default: 0 }
});

// Returns the next sequence value for `key`, creating the counter if needed.
counterSchema.statics.next = async function (key, session = null) {
  const opts = { new: true, upsert: true };
  if (session) opts.session = session;

  const counter = await this.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    opts
  );

  return counter.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
