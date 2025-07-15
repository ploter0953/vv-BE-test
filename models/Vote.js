const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  voter_id: { type: String, required: true },
  voted_vtuber_id: { type: String }, // For VTuber votes
  voted_artist_id: { type: String }, // For Artist votes
  vote_type: { type: String, enum: ['vtuber', 'artist'], required: true }, // Type of vote
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Vote', voteSchema); 