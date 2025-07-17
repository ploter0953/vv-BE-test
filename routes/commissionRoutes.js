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
  console.log('=== CREATE COMMISSION ===');
  console.log('User ID:', req.auth.userId);
  console.log('Request body:', req.body);
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
    console.log('=== CREATE COMMISSION SUCCESS ===');
  } catch (err) {
    console.error('=== CREATE COMMISSION ERROR ===');
    console.error('Error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Lấy tất cả commission
router.get('/', async (req, res) => {
  console.log('=== FETCH ALL COMMISSIONS ===');
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
    console.log('=== FETCH ALL COMMISSIONS SUCCESS ===');
  } catch (err) {
    console.error('=== COMMISSION FETCH ERROR ===');
    console.error('Error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Lấy commission theo id
router.get('/:id', async (req, res) => {
  console.log('=== FETCH SINGLE COMMISSION ===');
  console.log('Commission ID:', req.params.id);
  try {
    console.log('=== FETCHING SINGLE COMMISSION ===');
    
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
    console.log('=== FETCH SINGLE COMMISSION SUCCESS ===');
  } catch (err) {
    console.error('=== SINGLE COMMISSION FETCH ERROR ===');
    console.error('Error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Cập nhật commission
router.put('/:id', requireAuth(), async (req, res) => {
  console.log('=== UPDATE COMMISSION ===');
  console.log('User ID:', req.auth.userId, 'CommissionId:', req.params.id, 'Body:', req.body);
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
    console.log('=== UPDATE COMMISSION SUCCESS ===');
  } catch (err) {
    console.error('=== UPDATE COMMISSION ERROR ===');
    console.error('Error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Xóa commission
router.delete('/:id', requireAuth(), async (req, res) => {
  console.log('=== DELETE COMMISSION ===');
  console.log('User ID:', req.auth.userId, 'CommissionId:', req.params.id);
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
    console.log('=== DELETE COMMISSION SUCCESS ===');
  } catch (err) {
    console.error('=== DELETE COMMISSION ERROR ===');
    console.error('Error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Đặt commission (tạo order)
router.post('/:id/order', requireAuth(), async (req, res) => {
  console.log('=== CREATE ORDER FOR COMMISSION ===');
  console.log('Commission ID:', req.params.id);
  console.log('User ID:', req.auth.userId);
  console.log('Request body:', req.body);
  
  try {
    const commission = await Commission.findById(req.params.id);
    console.log('Found commission:', commission ? {
      id: commission._id,
      title: commission.title,
      status: commission.status,
      user: commission.user
    } : 'NOT FOUND');
    if (!commission) {
      console.log('Commission not found');
      return res.status(404).json({ message: 'Commission not found' });
    }
    
    console.log('Checking if user is trying to order their own commission...');
    console.log('Commission user:', commission.user);
    console.log('Request user ID:', req.auth.userId);
    console.log('Are they the same?', commission.user?.toString() === req.auth.userId?.toString());
    
    if (commission.user?.toString() === req.auth.userId?.toString()) {
      console.log('User is trying to order their own commission - BAD REQUEST');
      return res.status(400).json({ message: 'You cannot order your own commission' });
    }
    
    console.log('Commission status:', commission.status);
    if (commission.status !== 'open') {
      console.log('Commission is not open for orders - BAD REQUEST');
      return res.status(400).json({ message: 'This commission is not open for orders' });
    }

    // Tạo order mới
    console.log('Creating new order...');
    const order = new Order({
      commission: commission._id,
      buyer: req.auth.userId,
      status: 'pending'
    });
    await order.save();
    console.log('Order created successfully:', {
      id: order._id,
      commission: order.commission,
      buyer: order.buyer,
      status: order.status
    });

    // Cập nhật trạng thái commission
    console.log('Updating commission status to pending...');
    commission.status = 'pending';
    await commission.save();
    console.log('Commission status updated to pending');

    console.log('=== CREATE ORDER SUCCESS ===');
    res.status(201).json({ order, commission });
    console.log('=== CREATE ORDER FOR COMMISSION SUCCESS ===');
  } catch (err) {
    console.error('=== CREATE ORDER ERROR ===');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('Error name:', err.name);
    console.error('Error code:', err.code);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 