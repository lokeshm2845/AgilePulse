const express = require('express');
const ActivityLog = require('../models/ActivityLog');
const { protect } = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/activity?limit=20 - most recent actions, newest first (FR-24/25 viewer)
router.get(
  '/',
  protect,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const logs = await ActivityLog.find().sort({ timestamp: -1 }).limit(limit).populate('userId', 'name role');
    res.json(logs);
  })
);

module.exports = router;
