const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Project name is required'], trim: true },
  description: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['Active', 'Completed', 'Archived'], default: 'Active' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Project', projectSchema);
