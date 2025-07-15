const express = require('express');
const Commission = require('../models/Commission');
const User = require('../models/User');
const { requireAuth } = require('@clerk/express');

const router = express.Router();

// Use requireAuth() for all protected routes:
// router.post('/', requireAuth(), ...)

// Tạo commission
router.post('/', requireAuth(), async (req, res) => {
  try {
    const { title, description, price } = req.body;
    const commission = new Commission({
      title,
      description,
      price,
      user: req.auth.userId,
    });
    await commission.save();
    res.status(201).json(commission);
  } catch (err) {
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