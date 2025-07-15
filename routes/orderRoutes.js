const express = require('express');
const Order = require('../models/Order');
const Commission = require('../models/Commission');
const User = require('../models/User');
const { clerkExpressWithAuth } = require('@clerk/express');
const clerkMiddleware = clerkExpressWithAuth({ secretKey: process.env.CLERK_SECRET_KEY });

const router = express.Router();

// Tạo order
router.post('/', clerkMiddleware, async (req, res) => {
  try {
    const { commissionId } = req.body;
    const commission = await Commission.findById(commissionId);
    if (!commission) return res.status(404).json({ message: 'Commission not found' });
    const order = new Order({
      commission: commissionId,
      buyer: req.auth.userId,
    });
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy tất cả order
router.get('/', clerkMiddleware, async (req, res) => {
  try {
    const orders = await Order.find().populate('commission').populate('buyer', 'username email');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy order theo id
router.get('/:id', clerkMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('commission').populate('buyer', 'username email');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cập nhật trạng thái order
router.put('/:id', clerkMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    // Chỉ buyer hoặc admin mới được cập nhật
    const user = await User.findOne({ clerkId: req.auth.userId });
    if (order.buyer.toString() !== req.auth.userId && user.role !== 'admin') {
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
router.delete('/:id', clerkMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    // Chỉ buyer hoặc admin mới được xóa
    const user = await User.findOne({ clerkId: req.auth.userId });
    if (order.buyer.toString() !== req.auth.userId && user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await order.deleteOne();
    res.json({ message: 'Order deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 