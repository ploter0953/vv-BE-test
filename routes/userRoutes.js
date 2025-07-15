const express = require('express');
const User = require('../models/User');

const router = express.Router();

// Lấy danh sách user
router.get('/', async (req, res) => {
  try {
    // NOTE: Mongoose v7+ still supports Model.find(). If using native MongoDB driver, use collection.find({}).toArray().
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy user theo id
router.get('/:id', async (req, res) => {
  const mongoose = require('mongoose');
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy user theo clerkId
router.get('/clerk/:clerkId', async (req, res) => {
  try {
    const user = await User.findOne({ clerkId: req.params.clerkId });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
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

// Clerk sync endpoint
router.post('/clerk-sync', async (req, res) => {
  try {
    const { clerkId, email, username, avatar } = req.body;
    if (!clerkId || !email) {
      return res.status(400).json({ error: 'clerkId và email là bắt buộc' });
    }
    let user = await User.findOne({ clerkId });
    if (user) {
      // Đã có user, trả về profile
      return res.json({
        user,
        message: 'User đã tồn tại, trả về profile.'
      });
    }
    // Nếu chưa có, tạo mới user với các trường mặc định
    user = await User.create({
      clerkId,
      email,
      username: username || '',
      avatar: avatar || '',
      badges: ['member'],
      bio: '',
      description: '',
      facebook: '',
      website: '',
      profile_email: '',
      vtuber_description: '',
      artist_description: ''
    });
    return res.status(201).json({
      user,
      message: 'Tạo user mới thành công.'
    });
  } catch (error) {
    console.error('Clerk sync error:', error);
    res.status(500).json({ error: 'Lỗi server khi đồng bộ user với Clerk.' });
  }
});

module.exports = router; 