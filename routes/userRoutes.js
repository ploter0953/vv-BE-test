const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for email verification
const emailVerificationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // limit each IP to 3 requests per windowMs
  message: { message: 'Quá nhiều yêu cầu gửi mã. Vui lòng thử lại sau 5 phút.' }
});

// Rate limiting for registration
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { message: 'Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau 15 phút.' }
});

// Lấy danh sách user
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy user theo id
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cập nhật user profile
router.put('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const {
      avatar, bio, description, vtuber_description, artist_description,
      profile_email, facebook, website, youtube, twitch, twitter, instagram
    } = req.body;

    // Update fields
    if (avatar !== undefined) user.avatar = avatar;
    if (bio !== undefined) user.bio = bio;
    if (description !== undefined) user.description = description;
    if (vtuber_description !== undefined) user.vtuber_description = vtuber_description;
    if (artist_description !== undefined) user.artist_description = artist_description;
    if (profile_email !== undefined) user.profile_email = profile_email;
    if (facebook !== undefined) user.facebook = facebook;
    if (website !== undefined) user.website = website;
    if (youtube !== undefined) user.youtube = youtube;
    if (twitch !== undefined) user.twitch = twitch;
    if (twitter !== undefined) user.twitter = twitter;
    if (instagram !== undefined) user.instagram = instagram;

    await user.save();
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy commissions của user
router.get('/:id/commissions', async (req, res) => {
  try {
    const { Commission } = require('../models/Commission');
    const commissions = await Commission.find({ user: req.params.id });
    res.json({ commissions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Xóa user
router.delete('/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 