const express = require('express');
const Order = require('../models/Order');
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

// Tạo order
router.post('/', auth, async (req, res) => {
  try {
    const { commissionId } = req.body;
    const commission = await Commission.findById(commissionId);
    if (!commission) return res.status(404).json({ message: 'Commission not found' });
    const order = new Order({
      commission: commissionId,
      buyer: req.user.userId,
    });
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy tất cả order
router.get('/', auth, async (req, res) => {
  try {
    const orders = await Order.find().populate('commission').populate('buyer', 'username email');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy order theo id
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('commission').populate('buyer', 'username email');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cập nhật trạng thái order
router.put('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    // Chỉ buyer hoặc admin mới được cập nhật
    if (order.buyer.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    order.status = req.body.status || order.status;
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Xóa order
router.delete('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    // Chỉ buyer hoặc admin mới được xóa
    if (order.buyer.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await order.deleteOne();
    res.json({ message: 'Order deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 