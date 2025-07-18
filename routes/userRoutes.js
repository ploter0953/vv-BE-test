const express = require('express');
const User = require('../models/User');
const mongoose = require('mongoose');

const router = express.Router();

// Tìm user theo username (GET /api/users?username=...)
router.get('/', async (req, res) => {
  try {
    const { username } = req.query;
    if (username) {
      console.log('[DEBUG] Tìm kiếm user:', username);
      // Tìm user theo username, không phân biệt hoa thường, partial match
      const users = await User.find({ username: { $regex: username, $options: 'i' } });
      console.log('[DEBUG] Số kết quả:', users.length);
      return res.json({ users });
    }
    // Nếu không có query, trả về tất cả user (hoặc có thể trả về rỗng)
    const users = await User.find();
    res.json({ users });
  } catch (err) {
    console.error('[DEBUG] Lỗi tìm kiếm user:', err);
    res.status(500).json({ message: err.message });
  }
});

// Lấy user theo clerkId (PHẢI đặt trước route /:id)
router.get('/clerk/:clerkId', async (req, res) => {
  try {
    const user = await User.findOne({ clerkId: req.params.clerkId });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy commissions của user (hỗ trợ cả ObjectId và ClerkId)
router.get('/:id/commissions', async (req, res) => {
  const { id } = req.params;
  let user;
  const mongoose = require('mongoose');
  if (id.startsWith('user_')) {
    user = await User.findOne({ clerkId: id });
  } else if (mongoose.Types.ObjectId.isValid(id)) {
    user = await User.findById(id);
  }
  if (!user) return res.status(404).json({ message: 'User not found' });
  const commissions = await require('../models/Commission').find({ user: user.clerkId });
  res.json({ commissions });
});

// Lấy user theo id (MongoDB ObjectId)
router.get('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }
  try {
    const user = await User.findById(req.params.id);
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
      return res.json({
        user,
        message: 'User đã tồn tại, trả về profile.'
      });
    }
    user = await User.create({
      clerkId,
      email,
      username: username || '',
      avatar: avatar || '',
      banner: '', // Ensure banner field is always set
      role: 'user',
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