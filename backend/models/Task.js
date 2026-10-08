const mongoose = require('mongoose');

const STATUSES = ['To-Do', 'In Progress', 'Review', 'Done'];
const FIBONACCI_POINTS = [1, 2, 3, 5, 8, 13];
const PRIORITIES = ['High', 'Medium', 'Low'];

/**
 * A Task doubles as a User Story:
 *  - sprintId = null  -> the story sits in the Product Backlog
 *  - sprintId = <id>  -> the story is committed to that sprint and shows on the Kanban board
 * createdAt / updatedAt are maintained automatically by `timestamps`.
 */
const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: STATUSES, default: 'To-Do' },
    storyPoints: {
      type: Number,
      default: 1,
      validate: {
        validator: (v) => FIBONACCI_POINTS.includes(v),
        message: 'Story points must be one of 1, 2, 3, 5, 8, 13',
      },
    },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sprintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint', default: null },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Speeds up board / backlog queries (NFR-19: 100k+ tasks)
taskSchema.index({ sprintId: 1, status: 1 });

module.exports = mongoose.model('Task', taskSchema);
module.exports.STATUSES = STATUSES;
module.exports.FIBONACCI_POINTS = FIBONACCI_POINTS;
module.exports.PRIORITIES = PRIORITIES;
