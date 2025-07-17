const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  type: { type: String },
  price: { type: Number, required: true },
  currency: { type: String, default: 'VND' },
  deadline: { type: Date },
  requirements: { type: [String], default: [] },
  tags: { type: [String], default: [] },
  examples: { type: [String], default: [] },
  status: { 
    type: String, 
    enum: [
      'open', 
      'pending', 
      'in_progress', 
      'waiting_customer_confirmation', 
      'completed', 
      'cancelled'
    ], 
    default: 'open' 
  },
  user: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Commission', commissionSchema); 