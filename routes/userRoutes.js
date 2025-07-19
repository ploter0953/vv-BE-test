const express = require('express');
const User = require('../models/User');
const mongoose = require('mongoose');
const { requireAuth } = require('@clerk/express');

const router = express.Router();

// Search users by username
router.get('/', async (req, res) => {
  try {
    const { username } = req.query;
    if (username && username.trim()) {
      const searchTerm = username.trim();
      
      // Search with priority: exact match first, then partial match
      const searchQuery = {
        $or: [
          // Exact match on username (highest priority)
          { username: { $regex: `^${searchTerm}$`, $options: 'i' } },
          // Partial match on username (second priority)
          { username: { $regex: searchTerm, $options: 'i' } },
          // Exact match on email (if username not found)
          { email: { $regex: `^${searchTerm}$`, $options: 'i' } },
          // Partial match on email (if username not found)
          { email: { $regex: searchTerm, $options: 'i' } }
        ]
      };
      
      const users = await User.find(searchQuery).sort({ username: 1 });
      console.log(`[SEARCH] Keyword: "${searchTerm}", Found: ${users.length} users`);
      console.log(`[SEARCH] Results:`, users.map(u => ({ username: u.username, email: u.email })));
      return res.json({ users });
    }
    // If no query or empty query, return empty array
    return res.json({ users: [] });
  } catch (err) {
    console.error('Error searching users:', err);
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
router.post('/clerk-sync-test', async (req, res) => {
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
    
    // Create new user object
    const newUserObj = {
      clerkId,
      email,
      username: username || '',
      avatar: avatar || '',
      banner: '',
      role: 'user',
      badges: ['member'],
      bio: '',
      description: '',
      facebook: '',
      website: '',
      profile_email: '',
      vtuber_description: '',
      artist_description: ''
    };
    
    user = await User.create(newUserObj);
    return res.status(201).json({
      user,
      message: 'Tạo user mới thành công.'
    });
  } catch (error) {
    console.error('Clerk sync error:', error);
    res.status(500).json({ error: 'Lỗi server khi đồng bộ user với Clerk.' });
  }
});

// Update user online status
router.post('/online', requireAuth(), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.auth.userId, {
      isOnline: true,
      lastSeen: new Date()
    });
    res.json({ message: 'Online status updated' });
  } catch (error) {
    console.error('Error updating online status:', error);
    res.status(500).json({ message: 'Error updating online status' });
  }
});

// Update user offline status
router.post('/offline', requireAuth(), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.auth.userId, {
      isOnline: false,
      lastSeen: new Date()
    });
    res.json({ message: 'Offline status updated' });
  } catch (error) {
    console.error('Error updating offline status:', error);
    res.status(500).json({ message: 'Error updating offline status' });
  }
});

// Get user online status
router.get('/:id/status', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('isOnline lastSeen');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Calculate if user is considered online (within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isRecentlyActive = user.lastSeen > fiveMinutesAgo;
    
    res.json({
      isOnline: user.isOnline && isRecentlyActive,
      lastSeen: user.lastSeen,
      isRecentlyActive
    });
  } catch (error) {
    console.error('Error getting user status:', error);
    res.status(500).json({ message: 'Error getting user status' });
  }
});

module.exports = router; 