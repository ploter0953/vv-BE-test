const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  commission: { type: mongoose.Schema.Types.ObjectId, ref: 'Commission', required: true },
  buyer: { type: String, required: true }, // ClerkId
  // artist: { type: String }, // Uncomment if you want to store artist ClerkId
  status: { type: String, enum: ['pending', 'paid', 'delivered', 'cancelled'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema); 