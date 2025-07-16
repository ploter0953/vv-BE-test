const express = require('express');
const Commission = require('../models/Commission');
const User = require('../models/User');
const { requireAuth } = require('@clerk/express');
const Order = require('../models/Order'); // Đảm bảo đã require model Order

const router = express.Router();

// Use requireAuth() for all protected routes:
// router.post('/', requireAuth(), ...)

// Tạo commission
router.post('/', requireAuth(), async (req, res) => {
  console.log('[COMMISSION][CREATE] User:', req.auth.userId, 'Body:', req.body);
  console.log('=== COMMISSION CREATION REQUEST ===');
  console.log('User ID:', req.auth.userId);
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  
  try {
    const { title, description, type, price, currency, deadline, requirements, tags, examples } = req.body;
    
    console.log('Extracted data:');
    console.log('- Title:', title);
    console.log('- Description:', description);
    console.log('- Type:', type);
    console.log('- Price:', price, 'Type:', typeof price);
    console.log('- Currency:', currency);
    console.log('- Deadline:', deadline);
    console.log('- Requirements:', requirements);
    console.log('- Tags:', tags);
    console.log('- Examples:', examples);
    
    const commission = new Commission({
      title,
      description,
      type,
      price: Number(price),
      currency,
      deadline: deadline ? new Date(deadline) : undefined,
      requirements,
      tags,
      examples,
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
    console.log('=== FETCHING COMMISSIONS ===');
    
    // Lấy tất cả commission
    const commissions = await Commission.find();
    
    console.log('Found commissions:', commissions.length);
    
    // Xử lý dữ liệu trước khi trả về
    const processedCommissions = await Promise.all(commissions.map(async (commission) => {
      const commissionObj = commission.toObject();
      
      // Tìm thông tin user từ Clerk ID
      const user = await User.findOne({ clerkId: commissionObj.user });
      
      // Đảm bảo user info được hiển thị đúng
      if (user) {
        commissionObj.artistName = user.username || 'Unknown Artist';
        commissionObj.artistEmail = user.email;
        commissionObj.artistAvatar = user.avatar;
        commissionObj.artistRole = user.role;
      } else {
        commissionObj.artistName = 'Unknown Artist';
        commissionObj.artistEmail = '';
        commissionObj.artistAvatar = '';
        commissionObj.artistRole = 'user';
      }
      
      // Đảm bảo các trường mới có giá trị mặc định
      commissionObj.type = commissionObj.type || '';
      commissionObj.currency = commissionObj.currency || 'VND';
      commissionObj.deadline = commissionObj.deadline || null;
      commissionObj.requirements = commissionObj.requirements || [];
      commissionObj.tags = commissionObj.tags || [];
      commissionObj.examples = commissionObj.examples || [];
      // Always provide user_id for FE compatibility
      commissionObj.user_id = commissionObj.user;
      
      console.log('Processed commission:', {
        id: commissionObj._id,
        title: commissionObj.title,
        artistName: commissionObj.artistName,
        examples: commissionObj.examples.length
      });
      
      return commissionObj;
    }));
    
    console.log('Returning', processedCommissions.length, 'commissions');
    res.json({ commissions: processedCommissions });
  } catch (err) {
    console.error('=== COMMISSION FETCH ERROR ===');
    console.error('Error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Lấy commission theo id
router.get('/:id', async (req, res) => {
  try {
    console.log('=== FETCHING SINGLE COMMISSION ===');
    console.log('Commission ID:', req.params.id);
    
    const commission = await Commission.findById(req.params.id);
    if (!commission) {
      console.log('Commission not found');
      return res.status(404).json({ message: 'Not found' });
    }
    
    const commissionObj = commission.toObject();
    
    // Tìm thông tin user từ Clerk ID
    const user = await User.findOne({ clerkId: commissionObj.user });
    
    // Đảm bảo user info được hiển thị đúng
    if (user) {
      commissionObj.artistName = user.username || 'Unknown Artist';
      commissionObj.artistEmail = user.email;
      commissionObj.artistAvatar = user.avatar;
      commissionObj.artistRole = user.role;
    } else {
      commissionObj.artistName = 'Unknown Artist';
      commissionObj.artistEmail = '';
      commissionObj.artistAvatar = '';
      commissionObj.artistRole = 'user';
    }
    
    // Đảm bảo các trường mới có giá trị mặc định
    commissionObj.type = commissionObj.type || '';
    commissionObj.currency = commissionObj.currency || 'VND';
    commissionObj.deadline = commissionObj.deadline || null;
    commissionObj.requirements = commissionObj.requirements || [];
    commissionObj.tags = commissionObj.tags || [];
    commissionObj.examples = commissionObj.examples || [];
    // Always provide user_id for FE compatibility
    commissionObj.user_id = commissionObj.user;
    
    console.log('Returning commission:', {
      id: commissionObj._id,
      title: commissionObj.title,
      artistName: commissionObj.artistName
    });
    
    res.json({ commission: commissionObj });
  } catch (err) {
    console.error('=== SINGLE COMMISSION FETCH ERROR ===');
    console.error('Error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Cập nhật commission
router.put('/:id', requireAuth(), async (req, res) => {
  console.log('[COMMISSION][UPDATE] User:', req.auth.userId, 'CommissionId:', req.params.id, 'Body:', req.body);
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
  console.log('[COMMISSION][DELETE] User:', req.auth.userId, 'CommissionId:', req.params.id);
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

// Đặt commission (tạo order)
router.post('/:id/order', requireAuth(), async (req, res) => {
  console.log('[COMMISSION][ORDER] User:', req.auth.userId, 'CommissionId:', req.params.id);
  try {
    const commission = await Commission.findById(req.params.id);
    if (!commission) {
      console.log('[COMMISSION][ORDER][ERROR] Commission not found');
      return res.status(404).json({ message: 'Commission not found' });
    }
    if (commission.user?.toString() === req.auth.userId?.toString()) {
      console.log('[COMMISSION][ORDER][ERROR] User is trying to order their own commission:', req.auth.userId);
      return res.status(400).json({ message: 'You cannot order your own commission' });
    }
    if (commission.status !== 'open') {
      console.log('[COMMISSION][ORDER][ERROR] Commission is not open for orders. Current status:', commission.status);
      return res.status(400).json({ message: 'This commission is not open for orders' });
    }

    // Tạo order mới
    const order = new Order({
      commission: commission._id,
      buyer: req.auth.userId,
      status: 'pending'
    });
    await order.save();

    // Cập nhật trạng thái commission
    commission.status = 'pending';
    await commission.save();

    res.status(201).json({ order, commission });
  } catch (err) {
    console.error('[COMMISSION][ORDER][ERROR][500]', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 