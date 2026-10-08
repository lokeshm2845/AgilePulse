const ActivityLog = require('../models/ActivityLog');
const socketService = require('../services/socketService');

/**
 * Record a critical user action (FR-24) and push it to the live activity feed.
 * Logging must never break the request, so failures are swallowed.
 * Never pass passwords/tokens in `details` (NFR-22).
 */
async function logActivity(userId, action, details = '') {
  try {
    const entry = await ActivityLog.create({ userId, action, details });
    if (socketService.getIO()) {
      const populated = await entry.populate('userId', 'name role');
      socketService.emit('activity', populated);
    }
  } catch (err) {
    console.error('Activity log failed:', err.message);
  }
}

module.exports = { logActivity };
