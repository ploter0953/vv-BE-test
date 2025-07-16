const express = require('express');
const Commission = require('../models/Commission');
const User = require('../models/User');
const { requireAuth } = require('@clerk/express');

const router = express.Router();

// Use requireAuth() for all protected routes:
// router.post('/', requireAuth(), ...)

// Tạo commission
router.post('/', requireAuth(), async (req, res) => {
  console.log('=== COMMISSION CREATION REQUEST ===');
  console.log('User ID:', req.auth.userId);
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  
  try {
    const { title, description, price } = req.body;
    
    console.log('Extracted data:');
    console.log('- Title:', title);
    console.log('- Description:', description);
    console.log('- Price:', price, 'Type:', typeof price);
    
    const commission = new Commission({
      title,
      description,
      price,
      user: req.auth.userId,
    });
    
    console.log('Commission object before save:', JSON.stringify(commission, null, 2));
    
    await commission.save();
    
    console.log('Commission saved successfully with ID:', commission._id);
    console.log('Final commission object:', JSON.stringify(commission, null, 2));
    
    res.status(201).json(commission);
  } catch (err) {
    console.error('=== COMMISSION CREATION ERROR ===');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('Error name:', err.name);
    console.error('Error code:', err.code);
    
    res.status(500).json({ message: err.message });
  }
});

// Lấy tất cả commission
router.get('/', async (req, res) => {
  try {
    const commissions = await Commission.find().populate('user', 'username email');
    res.json(commissions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy commission theo id
router.get('/:id', async (req, res) => {
  try {
    const commission = await Commission.findById(req.params.id).populate('user', 'username email');
    if (!commission) return res.status(404).json({ message: 'Not found' });
    res.json(commission);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cập nhật commission
router.put('/:id', requireAuth(), async (req, res) => {
  try {
    const commission = await Commission.findById(req.params.id);
    if (!commission) return res.status(404).json({ message: 'Not found' });
    const user = await User.findOne({ clerkId: req.auth.userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (commission.user.toString() !== req.auth.userId && user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    Object.assign(commission, req.body);
    await commission.save();
    res.json(commission);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Xóa commission
router.delete('/:id', requireAuth(), async (req, res) => {
  try {
    const commission = await Commission.findById(req.params.id);
    if (!commission) return res.status(404).json({ message: 'Not found' });
    const user = await User.findOne({ clerkId: req.auth.userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (commission.user.toString() !== req.auth.userId && user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await commission.deleteOne();
    res.json({ message: 'Commission deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 