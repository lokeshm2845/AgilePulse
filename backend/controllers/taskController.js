/**
 * TaskController - Kanban board tasks (FR-16 .. FR-20)
 */
const Task = require('../models/Task');
const Sprint = require('../models/Sprint');
const asyncHandler = require('../utils/asyncHandler');
const { validateTransition } = require('../utils/workflow');
const { assertCapacity } = require('../utils/sprintCapacity');
const { logActivity } = require('../utils/activityLogger');
const socketService = require('../services/socketService');

const USER_FIELDS = 'name email role';
const EDITABLE_FIELDS = ['title', 'description', 'storyPoints', 'priority', 'assignedTo'];

const populateTask = (id) => Task.findById(id).populate('assignedTo', USER_FIELDS);

// GET /api/tasks?sprintId=<id>
const getTasks = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.sprintId) filter.sprintId = req.query.sprintId;

  const tasks = await Task.find(filter).populate('assignedTo', USER_FIELDS).sort({ createdAt: 1 });
  res.json(tasks);
});

// POST /api/tasks  (PO / SM)
const createTask = asyncHandler(async (req, res) => {
  const { title, description, storyPoints, priority, assignedTo, sprintId, projectId } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Title is required' });
  }

  if (sprintId) {
    const sprint = await Sprint.findById(sprintId);
    if (!sprint) return res.status(404).json({ message: 'Sprint not found' });
    await assertCapacity(sprint, Number(storyPoints) || 1);
  }

  const task = await Task.create({
    title,
    description,
    storyPoints,
    priority,
    assignedTo: assignedTo || null,
    sprintId: sprintId || null,
    projectId: projectId || null,
    createdBy: req.user._id,
  });

  const populated = await populateTask(task._id);
  await logActivity(req.user._id, 'TASK_CREATED', `Task "${task.title}" created`);
  socketService.emit('taskCreated', populated);
  return res.status(201).json(populated);
});

// PUT /api/tasks/:id  - drag-and-drop status change (DEV) or field edit (PO / SM)
const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: 'Task not found' });

  const { status } = req.body;
  const isStatusChange = status !== undefined && status !== task.status;

  // ---- 1. Status change (drag-and-drop) ----
  if (isStatusChange) {
    if (req.user.role !== 'DEV') {
      return res.status(403).json({ message: 'Only Developers can move task cards on the board' });
    }
    if (!validateTransition(task.status, status)) {
      return res.status(400).json({
        message: 'Invalid workflow transition',
        detail: `Cannot move from "${task.status}" to "${status}". Tasks must move one step forward: To-Do → In Progress → Review → Done.`,
      });
    }
    task.status = status;
  }

  // ---- 2. Field edits ----
  const edits = EDITABLE_FIELDS.filter((f) => req.body[f] !== undefined);
  if (edits.length > 0) {
    if (!['PO', 'SM'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only the Product Owner or Scrum Master can edit task details' });
    }
    // Re-check sprint capacity if the estimate grows
    if (req.body.storyPoints !== undefined && task.sprintId) {
      const sprint = await Sprint.findById(task.sprintId);
      if (sprint) await assertCapacity(sprint, Number(req.body.storyPoints), task._id);
    }
    edits.forEach((f) => {
      task[f] = f === 'assignedTo' && !req.body[f] ? null : req.body[f];
    });
  }

  await task.save();
  const populated = await populateTask(task._id);

  if (isStatusChange) {
    await logActivity(req.user._id, 'TASK_MOVED', `Task "${task.title}" moved to ${task.status}`);
  } else if (edits.length > 0) {
    await logActivity(req.user._id, 'TASK_EDITED', `Task "${task.title}" edited (${edits.join(', ')})`);
  }

  // FR-20: push the change to every connected dashboard
  socketService.emit('taskUpdated', populated);
  return res.json(populated);
});

// DELETE /api/tasks/:id  (PO / SM)
const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) return res.status(404).json({ message: 'Task not found' });

  await logActivity(req.user._id, 'TASK_DELETED', `Task "${task.title}" deleted`);
  socketService.emit('taskDeleted', { _id: task._id });
  return res.json({ message: 'Task deleted', _id: task._id });
});

module.exports = { getTasks, createTask, updateTask, deleteTask };
