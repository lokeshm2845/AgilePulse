const mongoose = require('mongoose');
const Task = require('../models/Task');
const { httpError } = require('../middleware/errorMiddleware');

/** Total story points already committed to a sprint (optionally ignoring one task) */
async function committedPoints(sprintId, excludeTaskId = null) {
  const match = { sprintId: new mongoose.Types.ObjectId(String(sprintId)) };
  if (excludeTaskId) match._id = { $ne: new mongoose.Types.ObjectId(String(excludeTaskId)) };

  const [result] = await Task.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$storyPoints' } } }]);
  return result ? result.total : 0;
}

/**
 * FR-14: throw 400 "Sprint Capacity Exceeded" if adding `points` would push
 * the sprint over its velocityCapacity.
 */
async function assertCapacity(sprint, points, excludeTaskId = null) {
  const used = await committedPoints(sprint._id, excludeTaskId);
  if (used + points > sprint.velocityCapacity) {
    throw httpError(
      400,
      `Sprint Capacity Exceeded: ${sprint.name} has ${sprint.velocityCapacity - used} of ${sprint.velocityCapacity} points free, story needs ${points}`
    );
  }
}

module.exports = { committedPoints, assertCapacity };
