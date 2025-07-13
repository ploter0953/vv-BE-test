const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  logo_url: { type: String },
  avatar_url: { type: String },
  vtubers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  created_date: { type: Date, required: true },
  project_description: { type: String },
  status: { type: String, enum: ['active', 'inactive', 'completed'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema); 