const mongoose = require('mongoose');

const sprintSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Sprint name is required'], trim: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  startDate: { type: Date, required: [true, 'Start date is required'] },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator(value) {
        // `this` is the document on save; skip the check on query updates
        return !(this instanceof mongoose.Document) || !this.startDate || value >= this.startDate;
      },
      message: 'End date must be on or after the start date',
    },
  },
  velocityCapacity: {
    type: Number,
    required: [true, 'Velocity capacity is required'],
    min: [1, 'Velocity capacity must be at least 1'],
  },
  status: { type: String, enum: ['Planned', 'Active', 'Completed'], default: 'Planned' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Sprint', sprintSchema);
