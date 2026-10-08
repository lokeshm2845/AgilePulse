/**
 * AuthController - register, login, logout, current user (FR-01 .. FR-06)
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ROLES } = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../utils/activityLogger');

const SALT_ROUNDS = 10; // NFR-05
const MAX_FAILED_ATTEMPTS = 3; // FR-06
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const TOKEN_EXPIRY = '1d';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function cookieOptions() {
  // 'lax' when frontend and API share one domain (recommended deployment).
  // Set COOKIE_SAMESITE=none only if the frontend is hosted on a different domain.
  const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  return {
    httpOnly: true, // JS in the browser cannot read the token (NFR-06)
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none', // HTTPS only
    sameSite,
    maxAge: COOKIE_MAX_AGE_MS,
  };
}

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  if (role && !ROLES.includes(role)) {
    return res.status(400).json({ message: `Role must be one of ${ROLES.join(', ')}` });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'Email is already registered' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, passwordHash, role });

  await logActivity(user._id, 'REGISTER', `New ${user.role} account created`);
  return res.status(201).json({ message: 'User registered successfully', user: user.toPublicJSON() });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  // Same message for unknown email and wrong password - do not reveal which one failed
  const invalid = () => res.status(401).json({ message: 'Invalid email or password' });
  if (!user) return invalid();

  if (user.isLocked()) {
    const minutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return res.status(423).json({ message: `Account locked after too many failed attempts. Try again in ${minutes} minute(s).` });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
      user.failedLoginAttempts = 0;
      await user.save();
      await logActivity(user._id, 'ACCOUNT_LOCKED', '3 consecutive failed login attempts');
      return res.status(423).json({ message: 'Account locked after 3 failed attempts. Try again in 15 minutes.' });
    }
    await user.save();
    return invalid();
  }

  // Successful login - reset lock counters
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  user.lastLogin = new Date();
  await user.save();

  const token = signToken(user);
  res.cookie('token', token, cookieOptions());
  await logActivity(user._id, 'LOGIN', 'User logged in');

  return res.json({ message: 'Login successful', user: user.toPublicJSON(), token });
});

// POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  // A JWT cannot be "deleted" server-side; removing the HttpOnly cookie ends the
  // browser session and the token itself expires after 1 day (FR-05).
  res.clearCookie('token', { ...cookieOptions(), maxAge: undefined });
  const token = req.cookies && req.cookies.token;
  const decoded = token ? jwt.decode(token) : null;
  if (decoded && decoded.id) await logActivity(decoded.id, 'LOGOUT', 'User logged out');
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me - lets the frontend restore the session on page reload
const me = (req, res) => res.json({ user: req.user.toPublicJSON() });

// GET /api/auth/users - list users (used to assign tasks)
const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ name: 1 });
  res.json(users.map((u) => u.toPublicJSON()));
});

module.exports = { register, login, logout, me, listUsers };
