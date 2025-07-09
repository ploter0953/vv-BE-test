// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Parse allowed origins from environment variable
const getAllowedOrigins = () => {
  return [
    'https://projectvtuber.com',
    'https://www.projectvtuber.com',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://localhost:3000',
    'https://localhost:5173'
  ];
};

// Middleware to ensure JSON responses
app.use((req, res, next) => {
  // Set default content type for API responses
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Middleware to log requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'} - User-Agent: ${req.headers['user-agent']?.substring(0, 50) || 'No user-agent'}`);
  next();
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    const allowedOrigins = getAllowedOrigins();
    // Allow localhost for development
    if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
      return callback(null, true);
    }
    // Only allow production domain
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.log(`CORS blocked origin: ${origin}`);
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
    callback(null, false); // Block
  },
  credentials: true, // Enable credentials for cross-origin requests
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Handle CORS preflight requests
app.options('*', cors(corsOptions));

// Specific OPTIONS routes for main endpoints
app.options('/api/commissions', cors(corsOptions));
app.options('/api/users', cors(corsOptions));
app.options('/api/auth/*', cors(corsOptions));
app.options('/api/orders', cors(corsOptions));

// Kết nối MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vtuberverse';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected to', mongoose.connection.name))
  .catch(err => console.error('MongoDB connection error:', err));

// Mongoose User model
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String
});
const User = mongoose.model('User', userSchema);

// Commission Schema
const commissionSchema = new mongoose.Schema({
  title: String,
  description: String,
  type: Number,
  price: Number,
  currency: { type: String, default: 'VND' },
  status: { type: String, default: 'open' },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  artist_name: String,
  artist_avatar: String,
  deadline: String,
  requirements: [String],
  examples: [String],
  tags: [String],
  created_at: { type: Date, default: Date.now }
});
const Commission = mongoose.model('Commission', commissionSchema);

// Order Schema
const orderSchema = new mongoose.Schema({
  commission_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Commission' },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  artist_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, default: 'pending' },
  created_at: { type: Date, default: Date.now },
  confirmed_at: Date,
  completed_at: Date,
  customer_confirmed: { type: Boolean, default: false },
  rejection_reason: String
});
const Order = mongoose.model('Order', orderSchema);

// Helper function to hash password
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

// Helper function to compare password
function comparePassword(password, hashedPassword) {
  return bcrypt.compareSync(password, hashedPassword);
}

// Helper function to generate JWT token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Routes

// Register user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Tất cả các trường đều bắt buộc' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    // Check if user already exists
    const user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ error: 'Tên người dùng đã được sử dụng' });
    }

    // Create new user
    const hashedPassword = hashPassword(password);
    const avatar = '';

    const newUser = await User.create({ username, email, password: hashedPassword, avatar });

    const token = generateToken(newUser);
    res.status(201).json({
      message: 'Đăng ký thành công',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        avatar: newUser.avatar
      },
      token
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email và mật khẩu đều bắt buộc' });
    }
    // Tìm user theo email hoặc username
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.findOne({ username: email }); // Cho phép đăng nhập bằng username
    }
    if (!user || !comparePassword(password, user.password)) {
      return res.status(401).json({ error: 'Email/Username hoặc mật khẩu không đúng' });
    }
    const token = generateToken(user);
    res.json({
      message: 'Đăng nhập thành công',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar
      },
      token
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server', details: error.message });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get all users (for artist profiles)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({});
    res.json({ users });
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    res.json({ user });
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi server' });
  }
});

// Update user profile
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  const userId = req.params.id;
  const { avatar, bio, badge, facebook, zalo, phone, website } = req.body;

  // Check if user is updating their own profile
  if (userId !== req.user.id.toString()) {
    return res.status(403).json({ error: 'Không có quyền cập nhật profile này' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    user.avatar = avatar;
    user.bio = bio;
    user.badge = badge;
    user.facebook = facebook;
    user.zalo = zalo;
    user.phone = phone;
    user.website = website;

    await user.save();
    res.json({ message: 'Cập nhật profile thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi cập nhật profile' });
  }
});

// Create commission
app.post('/api/commissions', authenticateToken, async (req, res) => {
  try {
    const {
      title, description, type, price, currency, deadline, requirements, examples, tags
    } = req.body;
    if (!title || !description || !type || !price || !deadline) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Đảm bảo price là Number và không bị làm tròn sai
    const priceNumber = Number(price);
    if (isNaN(priceNumber) || priceNumber < 0) {
      return res.status(400).json({ error: 'Giá trị price không hợp lệ' });
    }
    const commission = await Commission.create({
      title, description, type, price: priceNumber, currency: currency || 'VND',
      status: 'open', user_id: user._id, artist_name: user.username, artist_avatar: user.avatar,
      deadline, requirements: requirements || [], examples: examples || [], tags: tags || []
    });
    res.status(201).json({ message: 'Commission tạo thành công', commission });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server', details: error.message });
  }
});

// Get all commissions
app.get('/api/commissions', async (req, res) => {
  try {
    const commissions = await Commission.find().sort({ created_at: -1 });
    res.json({ commissions });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get commission by ID
app.get('/api/commissions/:id', async (req, res) => {
  try {
    const commission = await Commission.findById(req.params.id);
    if (!commission) return res.status(404).json({ error: 'Commission không tồn tại' });
    res.json({ commission });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get commissions by user
app.get('/api/users/:id/commissions', async (req, res) => {
  try {
    const commissions = await Commission.find({ user_id: req.params.id }).sort({ created_at: -1 });
    res.json({ commissions });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Delete commission (artist can only delete if no pending orders)
app.delete('/api/commissions/:id', authenticateToken, async (req, res) => {
  try {
    const commission = await Commission.findById(req.params.id);
    if (!commission) return res.status(404).json({ error: 'Commission không tồn tại' });
    if (commission.user_id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Không có quyền xóa commission này' });
    }
    const activeOrders = await Order.countDocuments({ commission_id: commission._id, status: { $in: ['pending', 'confirmed', 'waiting_customer_confirmation', 'customer_rejected'] } });
    if (activeOrders > 0) {
      return res.status(400).json({ error: 'Không thể xóa commission đã có đơn hàng đang hoạt động' });
    }
    await Order.deleteMany({ commission_id: commission._id });
    await commission.deleteOne();
    res.json({ message: 'Xóa commission thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Create order (customer places commission)
app.post('/api/commissions/:id/order', authenticateToken, async (req, res) => {
  try {
    const commission = await Commission.findById(req.params.id);
    if (!commission || commission.status !== 'open') {
      return res.status(404).json({ error: 'Commission không tồn tại hoặc không mở' });
    }
    if (commission.user_id.toString() === req.user.id) {
      return res.status(400).json({ error: 'Không thể đặt commission của chính mình' });
    }
    const order = await Order.create({
      commission_id: commission._id,
      customer_id: req.user.id,
      artist_id: commission.user_id,
      status: 'pending'
    });
    commission.status = 'pending';
    await commission.save();
    res.status(201).json({ message: 'Đặt commission thành công', orderId: order._id });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Confirm order (artist confirms)
app.put('/api/orders/:id/confirm', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('commission_id');
    if (!order) return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
    if (order.artist_id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Không có quyền xác nhận đơn hàng này' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Đơn hàng đã được xử lý' });
    }
    order.status = 'confirmed';
    order.confirmed_at = new Date();
    await order.save();
    // Update commission status
    const commission = order.commission_id;
    commission.status = 'in_progress';
    await commission.save();
    res.json({ message: 'Xác nhận đơn hàng thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Complete order (artist marks as completed)
app.put('/api/orders/:id/complete', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('commission_id');
    if (!order) return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
    if (order.artist_id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Không có quyền hoàn thành đơn hàng này' });
    }
    if (order.status !== 'confirmed') {
      return res.status(400).json({ error: 'Đơn hàng chưa được xác nhận' });
    }
    order.status = 'waiting_customer_confirmation';
    order.completed_at = new Date();
    await order.save();
    // Update commission status
    const commission = order.commission_id;
    commission.status = 'waiting_customer_confirmation';
    await commission.save();
    res.json({ message: 'Đã đánh dấu hoàn thành. Chờ khách hàng xác nhận để hoàn tất đơn hàng.', requiresCustomerConfirmation: true });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Customer confirms completion
app.put('/api/orders/:id/customer-confirm', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('commission_id');
    if (!order) return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
    if (order.customer_id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Không có quyền xác nhận đơn hàng này' });
    }
    if (order.status !== 'waiting_customer_confirmation') {
      return res.status(400).json({ error: 'Đơn hàng chưa sẵn sàng để xác nhận' });
    }
    order.status = 'completed';
    order.customer_confirmed = true;
    await order.save();
    // Update commission status
    const commission = order.commission_id;
    commission.status = 'completed';
    await commission.save();
    res.json({ message: 'Xác nhận hoàn thành thành công. Đơn hàng đã hoàn tất!' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Customer cancels order
app.put('/api/orders/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('commission_id');
    if (!order) return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
    if (order.customer_id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Không có quyền hủy đơn hàng này' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Không thể hủy đơn hàng đã được xác nhận hoặc đang thực hiện' });
    }
    order.status = 'cancelled';
    await order.save();
    // Nếu không còn active order nào thì mở lại commission
    const activeOrders = await Order.countDocuments({ commission_id: order.commission_id._id, status: { $in: ['pending', 'confirmed', 'waiting_customer_confirmation', 'customer_rejected'] } });
    if (activeOrders === 0) {
      const commission = order.commission_id;
      commission.status = 'open';
      await commission.save();
    }
    res.json({ message: 'Hủy đơn hàng thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Customer rejects completion
app.put('/api/orders/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { rejection_reason } = req.body;
    const order = await Order.findById(req.params.id).populate('commission_id');
    if (!order) return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
    if (order.customer_id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Không có quyền từ chối đơn hàng này' });
    }
    if (order.status !== 'waiting_customer_confirmation') {
      return res.status(400).json({ error: 'Đơn hàng chưa sẵn sàng để từ chối' });
    }
    order.status = 'customer_rejected';
    order.rejection_reason = rejection_reason || 'Khách hàng từ chối xác nhận hoàn thành';
    await order.save();
    // Update commission status
    const commission = order.commission_id;
    commission.status = 'in_progress';
    await commission.save();
    res.json({ message: 'Đã từ chối xác nhận hoàn thành. Artist sẽ được thông báo để chỉnh sửa.' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get orders for user (as artist or customer)
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { role } = req.query; // 'artist' or 'customer'
    let filter = {};
    if (role === 'artist') {
      filter.artist_id = userId;
    } else {
      filter.customer_id = userId;
    }
    const orders = await Order.find(filter).populate('commission_id');
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
  console.log(`Server accessible from other machines on the network`);
  console.log(`CORS enabled for Cloudflare tunnel domains`);
}); 