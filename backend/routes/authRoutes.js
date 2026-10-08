const express = require('express');
const { register, login, logout, me, listUsers } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
// Public so a user with an expired token can still clear their cookie
router.post('/logout', logout);
router.get('/me', protect, me);
router.get('/users', protect, listUsers);

module.exports = router;
