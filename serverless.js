// Serverless-optimized version for Vercel deployment
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Parse allowed origins from environment variable
const getAllowedOrigins = () => {
  const origins = process.env.ALLOWED_ORIGINS;
  if (!origins) {
    return [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://localhost:3000',
      'https://localhost:5173',
      'https://*.vercel.app',
      'https://projectvtuber.com'
    ];
  }
  return origins.split(',').map(origin => origin.trim());
};

// Middleware to ensure JSON responses
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Middleware to log requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'}`);
  next();
});

// CORS configuration for serverless
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = getAllowedOrigins();
    
    // Allow localhost for development
    if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
      return callback(null, true);
    }
    
    // Allow Vercel preview domains
    if (origin.includes('vercel.app')) {
      return callback(null, true);
    }
    
    // Check against allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.log(`CORS blocked origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Helper functions
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function comparePassword(password, hashedPassword) {
  return bcrypt.compareSync(password, hashedPassword);
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'VtuberVerse API is working!',
    timestamp: new Date().toISOString(),
    serverless: true
  });
});

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected (serverless)'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  email: { type: String, unique: true },
  password: String,
  avatar: String,
  bio: String,
  badge: { type: String, default: 'member' },
  facebook: String,
  zalo: String,
  phone: String,
  website: String,
  created_at: { type: Date, default: Date.now }
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

// Register user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Tất cả các trường đều bắt buộc' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(400).json({ error: 'Email hoặc username đã tồn tại' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const user = await User.create({ username, email, password: hash });
    const token = generateToken({ id: user._id, username: user.username, email: user.email });
    res.status(201).json({ message: 'Đăng ký thành công!', token, user: { id: user._id, username, email } });
  } catch (error) {
    console.error('Register error:', error);
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
    const user = await User.findOne({ email });
    if (!user || !comparePassword(password, user.password)) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }
    const token = generateToken({ id: user._id, username: user.username, email: user.email });
    res.json({ message: 'Đăng nhập thành công!', token, user: { id: user._id, username: user.username, email: user.email, avatar: user.avatar, bio: user.bio, badge: user.badge } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'Người dùng không tồn tại' });
    res.json({ user });
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

// Export for serverless
module.exports = app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serverless server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
  });
} 