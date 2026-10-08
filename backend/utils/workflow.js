/**
 * Kanban workflow rules (FR-18).
 * A card may only move ONE step forward:
 *   To-Do -> In Progress -> Review -> Done
 * Skipping a stage (e.g. To-Do -> Done) or moving backwards is rejected.
 */
const ALLOWED_TRANSITIONS = {
  'To-Do': ['In Progress'],
  'In Progress': ['Review'],
  Review: ['Done'],
  Done: [],
};

/**
 * @param {string} oldStatus current status of the task
 * @param {string} newStatus requested status
 * @returns {boolean} true if the transition is allowed
 */
function validateTransition(oldStatus, newStatus) {
  const allowed = ALLOWED_TRANSITIONS[oldStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus);
}

module.exports = { validateTransition, ALLOWED_TRANSITIONS };
