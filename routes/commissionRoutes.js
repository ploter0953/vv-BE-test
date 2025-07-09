const express = require('express');
const Commission = require('../models/Commission');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware xác thực JWT
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Tạo commission
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, price } = req.body;
    const commission = new Commission({
      title,
      description,
      price,
      user: req.user.userId,
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
router.put('/:id', auth, async (req, res) => {
  try {
    const commission = await Commission.findById(req.params.id);
    if (!commission) return res.status(404).json({ message: 'Not found' });
    if (commission.user.toString() !== req.user.userId && req.user.role !== 'admin') {
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
router.delete('/:id', auth, async (req, res) => {
  try {
    const commission = await Commission.findById(req.params.id);
    if (!commission) return res.status(404).json({ message: 'Not found' });
    if (commission.user.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await commission.deleteOne();
    res.json({ message: 'Commission deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 