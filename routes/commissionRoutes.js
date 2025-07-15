const express = require('express');
const Commission = require('../models/Commission');
const { verifyToken } = require('@clerk/clerk-sdk-node');

const router = express.Router();

// Middleware xác thực Clerk
async function clerkAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No Clerk token' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { session, userId } = await verifyToken(token);
    if (!session || !userId) {
      return res.status(401).json({ message: 'Invalid Clerk session' });
    }
    req.user = { id: userId };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid Clerk session', error: err.message });
  }
}

// Tạo commission
router.post('/', clerkAuth, async (req, res) => {
  try {
    const { title, description, price } = req.body;
    const commission = new Commission({
      title,
      description,
      price,
      user: req.user.id,
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
router.put('/:id', clerkAuth, async (req, res) => {
  try {
    const commission = await Commission.findById(req.params.id);
    if (!commission) return res.status(404).json({ message: 'Not found' });
    if (commission.user.toString() !== req.user.id && req.user.role !== 'admin') {
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
router.delete('/:id', clerkAuth, async (req, res) => {
  try {
    const commission = await Commission.findById(req.params.id);
    if (!commission) return res.status(404).json({ message: 'Not found' });
    if (commission.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await commission.deleteOne();
    res.json({ message: 'Commission deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 