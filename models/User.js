const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  clerkId: { type: String, unique: true, required: true }, // Liên kết với user trên Clerk
  email: String, // Sync từ Clerk
  username: String, // Sync từ Clerk
  avatar: String, // Sync từ Clerk
  role: { type: String, enum: ['user', 'admin', 'artist'], default: 'user' },
  bio: String,
  description: String,
  badges: { type: [String], default: ['member'] },
  facebook: String,
  website: String,
  profile_email: String,
  vtuber_description: String,
  artist_description: String
});

module.exports = mongoose.model('User', userSchema); 