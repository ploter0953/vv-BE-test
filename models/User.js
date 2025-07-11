const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin', 'artist'], default: 'user' },
  profile_email: { type: String }, // Public email for profile display
  avatar: { type: String },
  bio: { type: String },
  social_links: {
    twitter: String,
    instagram: String,
    youtube: String,
    twitch: String,
    discord: String,
    zalo: String,
    phone: String,
    website: String
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema); 