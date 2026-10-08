/**
 * BacklogController - Product Backlog of user stories (FR-07 .. FR-11)
 * A backlog story is a Task whose sprintId is null.
 */
const Task = require('../models/Task');
const Sprint = require('../models/Sprint');
const asyncHandler = require('../utils/asyncHandler');
const { assertCapacity } = require('../utils/sprintCapacity');
const { logActivity } = require('../utils/activityLogger');
const socketService = require('../services/socketService');

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const STORY_FIELDS = ['title', 'description', 'storyPoints', 'priority'];

// GET /api/backlog - prioritised list: High > Medium > Low, then oldest first (FR-11)
const getBacklog = asyncHandler(async (req, res) => {
  const stories = await Task.find({ sprintId: null }).populate('createdBy', 'name').sort({ createdAt: 1 }).lean();
  stories.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  res.json(stories);
});

// POST /api/backlog  (PO)
const addStory = asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Story title is required' });
  }

  const story = await Task.create({
    ...pick(req.body, STORY_FIELDS),
    projectId: req.body.projectId || null,
    sprintId: null,
    createdBy: req.user._id,
  });

  await logActivity(req.user._id, 'STORY_CREATED', `Story "${story.title}" (${story.storyPoints} pts) added to backlog`);
  socketService.emit('backlogChanged', { _id: story._id });
  return res.status(201).json(story);
});

// PUT /api/backlog/:id  (PO)
const updateStory = asyncHandler(async (req, res) => {
  const story = await Task.findById(req.params.id);
  if (!story) return res.status(404).json({ message: 'Story not found' });

  const updates = pick(req.body, STORY_FIELDS);
  if (updates.storyPoints !== undefined && story.sprintId) {
    const sprint = await Sprint.findById(story.sprintId);
    if (sprint) await assertCapacity(sprint, Number(updates.storyPoints), story._id);
  }

  Object.assign(story, updates);
  await story.save();

  await logActivity(req.user._id, 'STORY_UPDATED', `Story "${story.title}" updated`);
  socketService.emit('backlogChanged', { _id: story._id });
  if (story.sprintId) socketService.emit('taskUpdated', story);
  return res.json(story);
});

// DELETE /api/backlog/:id  (PO)
const deleteStory = asyncHandler(async (req, res) => {
  const story = await Task.findByIdAndDelete(req.params.id);
  if (!story) return res.status(404).json({ message: 'Story not found' });

  await logActivity(req.user._id, 'STORY_DELETED', `Story "${story.title}" deleted`);
  socketService.emit('backlogChanged', { _id: story._id });
  if (story.sprintId) socketService.emit('taskDeleted', { _id: story._id });
  return res.json({ message: 'Story deleted', _id: story._id });
});

function pick(obj, keys) {
  return Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
}

module.exports = { getBacklog, addStory, updateStory, deleteStory };
