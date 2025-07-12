const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin', 'artist'], default: 'user' },
  profile_email: { type: String }, // Public email for profile display
  avatar: { type: String },
  bio: { type: String },
  vtuber_description: { type: String, maxlength: 50 }, // Description for VTuber badge users
  artist_description: { type: String, maxlength: 50 }, // Description for verified Artist badge users
  facebook: { type: String },
  website: { type: String },
  social_links: {
    twitter: String,
    instagram: String,
    youtube: String,
    twitch: String,
    discord: String
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema); 