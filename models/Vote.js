const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  voter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  voted_vtuber_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For VTuber votes
  voted_artist_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For Artist votes
  vote_type: { type: String, enum: ['vtuber', 'artist'], required: true }, // Type of vote
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Vote', voteSchema); 