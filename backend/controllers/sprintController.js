/**
 * SprintController - sprint lifecycle & velocity cap (FR-12 .. FR-15)
 */
const Sprint = require('../models/Sprint');
const Task = require('../models/Task');
const asyncHandler = require('../utils/asyncHandler');
const { assertCapacity, committedPoints } = require('../utils/sprintCapacity');
const { logActivity } = require('../utils/activityLogger');
const socketService = require('../services/socketService');

const SPRINT_FIELDS = ['name', 'startDate', 'endDate', 'velocityCapacity', 'status', 'projectId'];

// GET /api/sprints - each sprint includes its committed story points
const getSprints = asyncHandler(async (req, res) => {
  const sprints = await Sprint.find().sort({ startDate: -1 }).lean();
  const totals = await Task.aggregate([
    { $match: { sprintId: { $in: sprints.map((s) => s._id) } } },
    { $group: { _id: '$sprintId', points: { $sum: '$storyPoints' }, count: { $sum: 1 } } },
  ]);
  const byId = Object.fromEntries(totals.map((t) => [String(t._id), t]));

  res.json(
    sprints.map((s) => ({
      ...s,
      committedPoints: byId[String(s._id)]?.points || 0,
      taskCount: byId[String(s._id)]?.count || 0,
    }))
  );
});

// POST /api/sprints  (SM)
const createSprint = asyncHandler(async (req, res) => {
  const { name, startDate, endDate, velocityCapacity } = req.body;
  if (!name || !startDate || !endDate || velocityCapacity === undefined) {
    return res.status(400).json({ message: 'Name, start date, end date and velocity capacity are required' });
  }

  const sprint = await Sprint.create({ ...pick(req.body, SPRINT_FIELDS), status: 'Planned' });
  await logActivity(req.user._id, 'SPRINT_CREATED', `Sprint "${sprint.name}" created (capacity ${sprint.velocityCapacity})`);
  socketService.emit('sprintChanged', sprint);
  return res.status(201).json(sprint);
});

// PUT /api/sprints/:id  (SM) - edit, start (Active) or close (Completed)
const updateSprint = asyncHandler(async (req, res) => {
  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return res.status(404).json({ message: 'Sprint not found' });

  const updates = pick(req.body, SPRINT_FIELDS);

  // Capacity cannot drop below the points already committed
  if (updates.velocityCapacity !== undefined) {
    const used = await committedPoints(sprint._id);
    if (Number(updates.velocityCapacity) < used) {
      return res.status(400).json({ message: `Velocity capacity cannot be lower than committed points (${used})` });
    }
  }

  // Only one sprint may be Active at a time
  if (updates.status === 'Active' && sprint.status !== 'Active') {
    const active = await Sprint.findOne({ status: 'Active', _id: { $ne: sprint._id } });
    if (active) {
      return res.status(409).json({ message: `Sprint "${active.name}" is already active - close it first` });
    }
  }

  Object.assign(sprint, updates);
  await sprint.save();

  const action = updates.status === 'Completed' ? 'SPRINT_CLOSED' : 'SPRINT_UPDATED';
  await logActivity(req.user._id, action, `Sprint "${sprint.name}" ${action === 'SPRINT_CLOSED' ? 'closed' : 'updated'}`);
  socketService.emit('sprintChanged', sprint);
  return res.json(sprint);
});

// DELETE /api/sprints/:id  (SM) - its stories go back to the backlog
const deleteSprint = asyncHandler(async (req, res) => {
  const sprint = await Sprint.findByIdAndDelete(req.params.id);
  if (!sprint) return res.status(404).json({ message: 'Sprint not found' });

  await Task.updateMany({ sprintId: sprint._id }, { sprintId: null, status: 'To-Do' });
  await logActivity(req.user._id, 'SPRINT_DELETED', `Sprint "${sprint.name}" deleted`);
  socketService.emit('sprintChanged', { _id: sprint._id, deleted: true });
  return res.json({ message: 'Sprint deleted - its stories were returned to the backlog', _id: sprint._id });
});

// POST /api/sprints/:id/tasks  { taskId }  (SM) - move a backlog story into the sprint (FR-13, FR-14)
const addTaskToSprint = asyncHandler(async (req, res) => {
  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return res.status(404).json({ message: 'Sprint not found' });
  if (sprint.status === 'Completed') {
    return res.status(400).json({ message: 'Cannot add stories to a completed sprint' });
  }

  const task = await Task.findById(req.body.taskId);
  if (!task) return res.status(404).json({ message: 'Story not found' });
  if (task.sprintId) {
    return res.status(400).json({ message: 'Story is already planned in a sprint' });
  }

  await assertCapacity(sprint, task.storyPoints);

  task.sprintId = sprint._id;
  task.status = 'To-Do';
  await task.save();

  const populated = await Task.findById(task._id).populate('assignedTo', 'name email role');
  await logActivity(req.user._id, 'STORY_PLANNED', `"${task.title}" moved to sprint "${sprint.name}"`);
  socketService.emit('taskUpdated', populated);
  return res.json(populated);
});

// DELETE /api/sprints/:id/tasks/:taskId  (SM) - send a story back to the backlog
const removeTaskFromSprint = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ _id: req.params.taskId, sprintId: req.params.id });
  if (!task) return res.status(404).json({ message: 'Story not found in this sprint' });

  task.sprintId = null;
  task.status = 'To-Do';
  await task.save();

  await logActivity(req.user._id, 'STORY_UNPLANNED', `"${task.title}" returned to backlog`);
  socketService.emit('taskUpdated', task);
  return res.json(task);
});

function pick(obj, keys) {
  return Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
}

module.exports = { getSprints, createSprint, updateSprint, deleteSprint, addTaskToSprint, removeTaskFromSprint };
