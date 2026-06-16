const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Ad daxil edin'],
    trim: true,
    maxlength: [100, 'Ad 100 simvoldan çox ola bilməz']
  },
  email: {
    type: String,
    required: [true, 'Email daxil edin'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Düzgün email daxil edin']
  },
  phone: {
    type: String,
    required: [true, 'Telefon nömrəsi daxil edin']
  },
  password: {
    type: String,
    required: [true, 'Şifrə daxil edin'],
    minlength: [6, 'Şifrə minimum 6 simvol olmalıdır'],
    select: false
  },
  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.EMPLOYEE
  },
  ownerId: {
    type: String,
    required: [true, 'Owner ID tələb olunur'],
    index: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: function() {
      return this.role === ROLES.EMPLOYEE;
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

userSchema.index({ ownerId: 1, email: 1 });

userSchema.pre('save', async function(next) {
  // Only hash when the password actually changed. The previous version was
  // missing this `return`, so any save that didn't touch the password (e.g.
  // toggling isActive, updating lastLogin) fell through and re-hashed the
  // already-hashed value — corrupting the credential and locking the user out.
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      ownerId: this.ownerId,
      role: this.role,
      branchId: this.branchId
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

userSchema.methods.canSeeCostPrice = function() {
  return this.role === ROLES.SUPER_OWNER || this.role === ROLES.OWNER;
};

userSchema.methods.canAccessMainWarehouse = function() {
  return this.role === ROLES.SUPER_OWNER || this.role === ROLES.OWNER;
};

module.exports = mongoose.model('User', userSchema);
