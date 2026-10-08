const mongoose = require('mongoose');

const ROLES = ['PO', 'SM', 'DEV']; // Product Owner, Scrum Master, Developer

const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email is invalid'],
  },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ROLES, default: 'DEV' },
  // FR-06: account lock after 3 consecutive failed logins
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
});

userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil > Date.now());
};

// Never send the password hash or lock counters to the client
userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
  };
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
