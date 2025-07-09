const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  commission: { type: mongoose.Schema.Types.ObjectId, ref: 'Commission', required: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'paid', 'delivered', 'cancelled'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema); 