// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file hình ảnh'), false);
    }
  }
});

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Parse allowed origins from environment variable
const getAllowedOrigins = () => {
  // Only allow official domain
  const allowedOrigins = [
    'https://projectvtuber.com',
    'https://www.projectvtuber.com'
  ];
  
  return allowedOrigins;
};

// Enhanced origin validation middleware
const validateOrigin = (req, res, next) => {
  console.log(`validateOrigin middleware called for ${req.method} ${req.path}`);
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();
  
  // Log origin for debugging
  console.log(`Request origin: ${origin}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
  
  // Block requests with no origin (direct API access, Postman, curl, etc.)
  if (!origin) {
    console.log('No origin header - BLOCKING request (direct API access not allowed)');
    return res.status(403).json({
      error: 'Truy cập trực tiếp API không được phép',
      message: 'Vui lòng truy cập từ domain chính thức: https://www.projectvtuber.com',
      allowedOrigins: process.env.NODE_ENV === 'development' ? allowedOrigins : undefined
    });
  }
  
  // Check if origin is allowed
  if (allowedOrigins.includes(origin)) {
    console.log(`Origin ${origin} is allowed`);
    console.log(`validateOrigin middleware - PASSED`);
    return next();
  }
  
  // Block unauthorized origin
  console.log(`Origin ${origin} is NOT allowed - blocking request`);
  return res.status(403).json({
    error: 'Truy cập không được phép từ domain này',
    message: 'Vui lòng truy cập từ domain chính thức: https://www.projectvtuber.com',
    allowedOrigins: process.env.NODE_ENV === 'development' ? allowedOrigins : undefined
  });
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
  console.log(`Request headers:`, {
    origin: req.headers.origin,
    referer: req.headers.referer,
    'user-agent': req.headers['user-agent']?.substring(0, 100),
    'content-type': req.headers['content-type']
  });
  next();
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = getAllowedOrigins();
    
    console.log(`CORS middleware - Origin: ${origin}`);
    console.log(`CORS middleware - Allowed origins: ${allowedOrigins.join(', ')}`);
    
    // Block requests with no origin (direct API access, Postman, curl, etc.)
    if (!origin) {
      console.log('CORS: No origin - BLOCKING request (direct API access not allowed)');
      return callback(new Error('Truy cập trực tiếp API không được phép'), false);
    }
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      console.log(`CORS: Origin ${origin} is allowed`);
      return callback(null, true);
    }
    
    // Block unauthorized origin
    console.log(`CORS: Origin ${origin} is NOT allowed - blocking request`);
    console.log(`CORS: Allowed origins: ${allowedOrigins.join(', ')}`);
    return callback(new Error('Truy cập không được phép từ domain này'), false);
  },
  credentials: true, // Enable credentials for cross-origin requests
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Request tracking middleware
app.use('/api', (req, res, next) => {
  console.log(`=== REQUEST TRACKING ===`);
  console.log(`Method: ${req.method}`);
  console.log(`Path: ${req.path}`);
  console.log(`Full URL: ${req.originalUrl}`);
  console.log(`Origin: ${req.headers.origin}`);
  console.log(`User-Agent: ${req.headers['user-agent']?.substring(0, 50)}`);
  console.log(`=== END TRACKING ===`);
  next();
});

// Simple debug middleware for /api/users/vote specifically
app.use('/api/users/vote', (req, res, next) => {
  console.log('🔍 DEBUG: Request to /api/users/vote detected!');
  console.log('🔍 DEBUG: Method:', req.method);
  console.log('🔍 DEBUG: Query:', req.query);
  console.log('🔍 DEBUG: Headers:', {
    origin: req.headers.origin,
    'user-agent': req.headers['user-agent']?.substring(0, 50)
  });
  next();
});

// Apply origin validation middleware to all API routes
app.use('/api', (req, res, next) => {
  console.log(`🚀 BEFORE validateOrigin: ${req.method} ${req.path}`);
  validateOrigin(req, res, next);
});

// Additional security: Block common API testing tools
app.use('/api', (req, res, next) => {
  console.log(`User-agent blocking middleware called for ${req.method} ${req.path}`);
  const userAgent = req.headers['user-agent'] || '';
  const blockedTools = [
    'postman',
    'insomnia',
    'curl',
    'wget',
    'python-requests',
    'httpie',
    'thunder client',
    'rest client'
  ];
  
  // Skip for OPTIONS requests
  if (req.method === 'OPTIONS') {
    console.log(`User-agent blocking middleware - SKIPPED (OPTIONS request)`);
    return next();
  }
  
  const lowerUserAgent = userAgent.toLowerCase();
  const isBlockedTool = blockedTools.some(tool => lowerUserAgent.includes(tool));
  
  if (isBlockedTool) {
    console.log(`Blocked API testing tool: ${userAgent}`);
    return res.status(403).json({
      error: 'Truy cập API không được phép',
      message: 'Vui lòng truy cập từ domain chính thức: https://www.projectvtuber.com'
    });
  }
  
  console.log(`User-agent blocking middleware - PASSED`);
  next();
});

app.use(express.json());

// Handle CORS preflight requests
app.options('*', cors(corsOptions));

// Specific OPTIONS routes for main endpoints
app.options('/api/commissions', cors(corsOptions));
app.options('/api/users', cors(corsOptions));
app.options('/api/users/vote', cors(corsOptions));
app.options('/api/auth/*', cors(corsOptions));
app.options('/api/orders', cors(corsOptions));

// Kết nối MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vtuberverse';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected to', mongoose.connection.name);
  console.log('MongoDB connection state:', mongoose.connection.readyState);
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Add MongoDB connection event listeners
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});

// Mongoose User model
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['user', 'admin', 'artist'], default: 'user' },
  avatar: { type: String, default: '' },
  bio: String,
  badge: String, // Keep for backward compatibility
  badges: { type: [String], default: ['member'] }, // New field for multiple badges
  facebook: String,
  zalo: String,
  phone: String,
  website: String,
  profile_email: { type: String, unique: true, sparse: true }, // Added profile_email field with sparse index
  vote_bio: { type: String, default: '' }, // Mô tả ngắn riêng cho mục vote
  vtuber_description: String, // Added vtuber_description
  artist_description: String // Added artist_description
}, { timestamps: true });
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

// Vote Schema for VTuber voting
const voteSchema = new mongoose.Schema({
  voter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  voted_vtuber_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  created_at: { type: Date, default: Date.now }
});
const Vote = mongoose.model('Vote', voteSchema);

// VoteSpotlight Schema for Spotlight voting (VTuber & Artist)
const voteSpotlightSchema = new mongoose.Schema({
  voter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  voted_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['vtuber', 'artist'], required: true },
  created_at: { type: Date, default: Date.now }
});
const VoteSpotlight = mongoose.model('VoteSpotlight', voteSpotlightSchema);

// Feedback Schema
const feedbackSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  email: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

// Helper function to extract public_id from Cloudinary URL
function extractPublicIdFromCloudinaryUrl(url) {
  if (!url || !url.includes('cloudinary.com')) {
    return null;
  }
  
  try {
    // Cloudinary URL format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/filename.jpg
    const urlParts = url.split('/');
    const uploadIndex = urlParts.findIndex(part => part === 'upload');
    
    if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
      // Get the part after 'upload' and version
      const publicIdParts = urlParts.slice(uploadIndex + 2);
      // Remove file extension
      const publicId = publicIdParts.join('/').split('.')[0];
      return publicId;
    }
  } catch (error) {
    console.log('Error extracting public_id from URL:', error.message);
  }
  
  return null;
}

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
    { id: user._id, username: user.username, email: user.email },
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

// Health check endpoint with origin validation info
app.get('/api/health', (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: isProduction ? 'production' : 'development',
    origin: {
      current: origin || 'No origin header',
      allowed: allowedOrigins,
      isValid: !origin || allowedOrigins.includes(origin)
    },
    cors: {
      enabled: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    }
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

    // Check if user already exists by username
    const existingUserByUsername = await User.findOne({ username });
    if (existingUserByUsername) {
      return res.status(400).json({ error: 'Tên người dùng đã được sử dụng' });
    }

    // Check if user already exists by email
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      return res.status(400).json({ error: 'Email đã được sử dụng' });
    }

    // Create new user
    const hashedPassword = hashPassword(password);
    const avatar = '';

    const newUser = await User.create({ 
      username, 
      email, 
      password: hashedPassword, 
      avatar,
      badges: ['member'] // Default badge for new users
    });

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
    console.error('Registration error:', error);
    if (error.code === 11000) {
      // Duplicate key error
      if (error.keyPattern.username) {
        return res.status(400).json({ error: 'Tên người dùng đã được sử dụng' });
      }
      if (error.keyPattern.email) {
        return res.status(400).json({ error: 'Email đã được sử dụng' });
      }
      if (error.keyPattern.profile_email) {
        return res.status(400).json({ error: 'Profile email đã được sử dụng' });
      }
      // Generic duplicate key error
      return res.status(400).json({ error: 'Thông tin đã tồn tại trong hệ thống' });
    }
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
    // Always return badges (array) and badge (string) for compatibility
    res.json({
      message: 'Đăng nhập thành công',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        badge: user.badge || (user.badges && user.badges[0]) || 'member',
        badges: user.badges && user.badges.length > 0 ? user.badges : (user.badge ? [user.badge] : ['member'])
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
    res.json({ user: {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
      facebook: user.facebook,
      website: user.website,
      profile_email: user.profile_email,
      badge: user.badge || (user.badges && user.badges[0]) || 'member',
      badges: user.badges && user.badges.length > 0 ? user.badges : (user.badge ? [user.badge] : ['member'])
    }});
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
    res.json({ user: {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
      facebook: user.facebook,
      website: user.website,
      profile_email: user.profile_email,
      vtuber_description: user.vtuber_description,
      artist_description: user.artist_description,
      badge: user.badge || (user.badges && user.badges[0]) || 'member',
      badges: user.badges && user.badges.length > 0 ? user.badges : (user.badge ? [user.badge] : ['member'])
    }});
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi server' });
  }
});

// Update user profile
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  const userId = req.params.id;
  const { avatar, bio, facebook, website, profile_email, vtuber_description, artist_description } = req.body;

  // Check if user is updating their own profile
  if (userId !== req.user.id.toString()) {
    return res.status(403).json({ error: 'Không có quyền cập nhật profile này' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    // Check badge permissions for descriptions
    const userBadges = user.badge || user.badges || [];
    const hasVtuberBadge = userBadges.includes('vtuber');
    const hasVerifiedArtistBadge = userBadges.includes('verified');

    user.avatar = avatar;
    user.bio = bio;
    user.facebook = facebook;
    user.website = website;
    user.profile_email = profile_email;

    // Only allow vtuber_description if user has vtuber badge
    if (hasVtuberBadge && vtuber_description !== undefined) {
      if (vtuber_description && vtuber_description.length > 50) {
        return res.status(400).json({ error: 'Vtuber Description tối đa 50 ký tự' });
      }
      user.vtuber_description = vtuber_description;
    }

    // Only allow artist_description if user has verified badge
    if (hasVerifiedArtistBadge && artist_description !== undefined) {
      if (artist_description && artist_description.length > 50) {
        return res.status(400).json({ error: 'Artist Description tối đa 50 ký tự' });
      }
      user.artist_description = artist_description;
    }

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

    // Delete related images from Cloudinary
    try {
      // Delete examples images
      if (commission.examples && commission.examples.length > 0) {
        for (const exampleUrl of commission.examples) {
          const publicId = extractPublicIdFromCloudinaryUrl(exampleUrl);
          if (publicId) {
            try {
              await cloudinary.uploader.destroy(publicId);
              console.log(`Deleted image from Cloudinary: ${publicId}`);
            } catch (cloudinaryError) {
              console.log(`Could not delete image ${publicId} from Cloudinary:`, cloudinaryError.message);
            }
          }
        }
      }
    } catch (imageError) {
      console.log('Error deleting images from Cloudinary:', imageError.message);
      // Continue with commission deletion even if image deletion fails
    }

    // Delete related orders
    await Order.deleteMany({ commission_id: commission._id });
    
    // Delete the commission
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
    // Commission stays 'open' until artist confirms the order
    // Only change to 'pending' if this is the first order
    const pendingOrders = await Order.countDocuments({ 
      commission_id: commission._id, 
      status: 'pending' 
    });
    if (pendingOrders === 1) {
      commission.status = 'pending';
      await commission.save();
    }
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
    if (order.status !== 'confirmed' && order.status !== 'customer_rejected') {
      return res.status(400).json({ error: 'Đơn hàng chưa được xác nhận hoặc không thể hoàn thành' });
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

// Artist rejects order
app.put('/api/orders/:id/artist-reject', authenticateToken, async (req, res) => {
  try {
    const { rejection_reason } = req.body;
    const order = await Order.findById(req.params.id).populate('commission_id');
    if (!order) return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
    if (order.artist_id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Không có quyền từ chối đơn hàng này' });
    }
    if (order.status !== 'pending' && order.status !== 'confirmed' && order.status !== 'waiting_customer_confirmation') {
      return res.status(400).json({ error: 'Không thể từ chối đơn hàng ở trạng thái này' });
    }
    
    // If order is in waiting_customer_confirmation status, set it to cancelled for customer
    if (order.status === 'waiting_customer_confirmation') {
      order.status = 'cancelled';
      order.rejection_reason = rejection_reason || 'Artist từ chối xác nhận đơn hàng';
    } else {
      order.status = 'artist_rejected';
      order.rejection_reason = rejection_reason || 'Artist từ chối thực hiện đơn hàng';
    }
    
    await order.save();
    
    // Check if commission should be reopened
    const activeOrders = await Order.countDocuments({ 
      commission_id: order.commission_id._id, 
      status: { $in: ['pending', 'confirmed', 'waiting_customer_confirmation', 'customer_rejected'] } 
    });
    
    if (activeOrders === 0) {
      const commission = order.commission_id;
      commission.status = 'open';
      await commission.save();
    }
    
    const message = order.status === 'cancelled' 
      ? 'Đã từ chối xác nhận đơn hàng. Đơn hàng sẽ về trạng thái đã hủy và commission sẽ được mở lại.'
      : 'Đã từ chối đơn hàng. Commission sẽ được mở lại nếu không còn đơn hàng nào.';
    
    res.json({ message });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Auto-cancel pending orders after 7 days (optional endpoint for cleanup)
app.put('/api/orders/auto-cancel-pending', async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Find pending orders older than 7 days
    const pendingOrders = await Order.find({
      status: 'pending',
      created_at: { $lt: sevenDaysAgo }
    }).populate('commission_id');
    
    let cancelledCount = 0;
    
    for (const order of pendingOrders) {
      order.status = 'cancelled';
      await order.save();
      cancelledCount++;
      
      // Check if commission should be reopened
      const activeOrders = await Order.countDocuments({ 
        commission_id: order.commission_id._id, 
        status: { $in: ['pending', 'confirmed', 'waiting_customer_confirmation', 'customer_rejected'] } 
      });
      
      if (activeOrders === 0) {
        const commission = order.commission_id;
        commission.status = 'open';
        await commission.save();
      }
    }
    
    res.json({ 
      message: `Đã tự động hủy ${cancelledCount} đơn hàng chờ xác nhận quá 7 ngày`,
      cancelledCount 
    });
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
    const orders = await Order.find(filter)
      .populate('commission_id')
      .populate('customer_id', 'username avatar profile_email badge badges')
      .populate('artist_id', 'username avatar profile_email badge badges');
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Upload image to Cloudinary
app.post('/api/upload/image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Không có file được upload' });
    }

    // Convert buffer to base64
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'vtuberverse',
      resource_type: 'auto',
      transformation: [
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });

    res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Lỗi khi upload hình ảnh' });
  }
});

// Upload multiple images to Cloudinary
app.post('/api/upload/images', authenticateToken, upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Không có file được upload' });
    }

    const uploadPromises = req.files.map(async (file) => {
      const b64 = Buffer.from(file.buffer).toString('base64');
      const dataURI = `data:${file.mimetype};base64,${b64}`;

      const result = await cloudinary.uploader.upload(dataURI, {
        folder: 'vtuberverse',
        resource_type: 'auto',
        transformation: [
          { quality: 'auto', fetch_format: 'auto' }
        ]
      });

      return {
        url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height
      };
    });

    const results = await Promise.all(uploadPromises);

    res.json({
      success: true,
      images: results
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Lỗi khi upload hình ảnh' });
  }
});

// Delete image from Cloudinary
app.delete('/api/upload/image/:public_id', authenticateToken, async (req, res) => {
  try {
    const { public_id } = req.params;
    
    const result = await cloudinary.uploader.destroy(public_id);
    
    if (result.result === 'ok') {
      res.json({ success: true, message: 'Xóa hình ảnh thành công' });
    } else {
      res.status(400).json({ error: 'Không thể xóa hình ảnh' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Lỗi khi xóa hình ảnh' });
  }
});

// Delete image from Cloudinary by URL
app.delete('/api/upload/image-by-url', authenticateToken, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }
    
    const publicId = extractPublicIdFromCloudinaryUrl(imageUrl);
    
    if (!publicId) {
      return res.status(400).json({ error: 'Invalid Cloudinary URL' });
    }
    
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok') {
      res.json({ success: true, message: 'Xóa hình ảnh thành công', publicId });
    } else {
      res.status(400).json({ error: 'Không thể xóa hình ảnh' });
    }
  } catch (error) {
    console.error('Delete image by URL error:', error);
    res.status(500).json({ error: 'Lỗi khi xóa hình ảnh' });
  }
});

// Vote for a VTuber (1 vote per day per user)
app.post('/api/vote/vtuber', authenticateToken, async (req, res) => {
  try {
    const { voted_vtuber_id } = req.body;
    const voter_id = req.user.id;

    if (!voted_vtuber_id) {
      return res.status(400).json({ error: 'Vui lòng chọn VTuber để vote' });
    }

    // Check if voted user exists and has VTuber badge
    const votedUser = await User.findById(voted_vtuber_id);
    if (!votedUser) {
      return res.status(404).json({ error: 'VTuber không tồn tại' });
    }

    if (!votedUser.badges || !votedUser.badges.includes('vtuber')) {
      return res.status(400).json({ error: 'Chỉ có thể vote cho user có badge VTuber' });
    }

    // Check if voter is trying to vote for themselves
    if (voter_id === voted_vtuber_id) {
      return res.status(400).json({ error: 'Không thể vote cho chính mình' });
    }

    // Check if user has already voted today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingVote = await VoteSpotlight.findOne({
      voter_id,
      type: 'vtuber',
      created_at: {
        $gte: today,
        $lt: tomorrow
      }
    });

    if (existingVote) {
      return res.status(400).json({ error: 'Bạn đã vote hôm nay. Vui lòng thử lại vào ngày mai' });
    }

    // Create new vote
    const newVote = await VoteSpotlight.create({
      voter_id,
      voted_user_id: voted_vtuber_id,
      type: 'vtuber',
      created_at: new Date()
    });

    res.status(201).json({
      message: 'Vote thành công!',
      vote: newVote
    });

  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Vote for an Artist (1 vote per day per user)
app.post('/api/vote/artist', authenticateToken, async (req, res) => {
  try {
    const { voted_artist_id } = req.body;
    const voter_id = req.user.id;
    if (!voted_artist_id) {
      return res.status(400).json({ error: 'Vui lòng chọn Artist để vote' });
    }
    // Check if voted user exists and has Artist badge (verified, trusted, quality, partner)
    const votedUser = await User.findById(voted_artist_id);
    if (!votedUser) {
      return res.status(404).json({ error: 'Artist không tồn tại' });
    }
    const validArtistBadges = ['verified', 'trusted', 'quality', 'partner'];
    if (!votedUser.badges || !votedUser.badges.some(b => validArtistBadges.includes(b))) {
      return res.status(400).json({ error: 'Chỉ có thể vote cho user là Artist hợp lệ' });
    }
    if (voter_id === voted_artist_id) {
      return res.status(400).json({ error: 'Không thể vote cho chính mình' });
    }
    // Check if user has already voted for Artist today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const existingVote = await VoteSpotlight.findOne({
      voter_id,
      type: 'artist',
      created_at: { $gte: today, $lt: tomorrow }
    });
    if (existingVote) {
      return res.status(400).json({ error: 'Bạn đã vote Artist hôm nay. Vui lòng thử lại vào ngày mai' });
    }
    // Create new vote
    const newVote = await VoteSpotlight.create({
      voter_id,
      voted_user_id: voted_artist_id,
      type: 'artist',
      created_at: new Date()
    });
    res.status(201).json({ message: 'Vote Artist thành công!', vote: newVote });
  } catch (error) {
    console.error('Vote Artist error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get VTuber spotlight (top 5 VTubers by votes)
app.get('/api/spotlight/vtubers', async (req, res) => {
  try {
    // Get top 5 VTubers by vote count
    const topVTubers = await VoteSpotlight.aggregate([
      { $match: { type: 'vtuber' } },
      { $group: { _id: '$voted_user_id', voteCount: { $sum: 1 } } },
      { $sort: { voteCount: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'vtuber' } },
      { $unwind: '$vtuber' },
      { $match: { 'vtuber.badges': { $in: ['vtuber'] } } },
      { $project: { 
        _id: 1, 
        voteCount: 1, 
        username: '$vtuber.username', 
        avatar: '$vtuber.avatar', 
        bio: '$vtuber.bio',
        vtuber_description: '$vtuber.vtuber_description',
        artist_description: '$vtuber.artist_description',
        facebook: '$vtuber.facebook',
        website: '$vtuber.website'
      } }
    ]);
    res.json({ spotlight: topVTubers });
  } catch (error) {
    console.error('Spotlight VTuber error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get Artist spotlight (top 5 Artists by votes)
app.get('/api/spotlight/artists', async (req, res) => {
  try {
    // Get top 5 Artists by vote count
    const validArtistBadges = ['verified', 'trusted', 'quality', 'partner'];
    const topArtists = await VoteSpotlight.aggregate([
      { $match: { type: 'artist' } },
      { $group: { _id: '$voted_user_id', voteCount: { $sum: 1 } } },
      { $sort: { voteCount: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'artist' } },
      { $unwind: '$artist' },
      { $match: { 'artist.badges': { $in: validArtistBadges } } },
      { $project: { 
        _id: 1, 
        voteCount: 1, 
        username: '$artist.username', 
        avatar: '$artist.avatar', 
        bio: '$artist.bio',
        vtuber_description: '$artist.vtuber_description',
        artist_description: '$artist.artist_description',
        facebook: '$artist.facebook',
        website: '$artist.website'
      } }
    ]);
    res.json({ spotlight: topArtists });
  } catch (error) {
    console.error('Spotlight Artist error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get user's vote status for today (both vtuber & artist)
app.get('/api/vote/status', authenticateToken, async (req, res) => {
  try {
    const voter_id = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    // VTuber vote status
    const vtuberVote = await VoteSpotlight.findOne({
      voter_id,
      type: 'vtuber',
      created_at: { $gte: today, $lt: tomorrow }
    }).populate('voted_user_id', 'username avatar badge badges');
    // Artist vote status
    const artistVote = await VoteSpotlight.findOne({
      voter_id,
      type: 'artist',
      created_at: { $gte: today, $lt: tomorrow }
    }).populate('voted_user_id', 'username avatar badge badges');
    res.json({
      vtuber: {
        hasVotedToday: !!vtuberVote,
        todayVote: vtuberVote ? {
          voted_user: vtuberVote.voted_user_id,
          created_at: vtuberVote.created_at
        } : null
      },
      artist: {
        hasVotedToday: !!artistVote,
        todayVote: artistVote ? {
          voted_user: artistVote.voted_user_id,
          created_at: artistVote.created_at
        } : null
      }
    });
  } catch (error) {
    console.error('Vote status error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Test endpoint for debugging
app.get('/api/test-simple', (req, res) => {
  console.log('=== Simple test endpoint called ===');
  res.json({ 
    message: 'Simple test endpoint working!', 
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// Test endpoint for vtuber badge
app.get('/api/test/vtuber-badge', async (req, res) => {
  try {
    console.log('=== Testing vtuber badge users ===');
    
    // Check all users
    const allUsers = await User.find({}).select('username badges badge');
    console.log('All users:', allUsers.length);
    
    // Check users with vtuber badge
    const vtuberUsers = await User.find({ badges: { $in: ['vtuber'] } }).select('username badges badge');
    console.log('Users with vtuber badge:', vtuberUsers.length);
    
    // Check users with any badge
    const usersWithBadges = await User.find({ badges: { $exists: true, $ne: [] } }).select('username badges badge');
    console.log('Users with any badges:', usersWithBadges.length);
    
    res.json({
      totalUsers: allUsers.length,
      vtuberUsers: vtuberUsers.length,
      usersWithBadges: usersWithBadges.length,
      sampleUsers: allUsers.slice(0, 5),
      vtuberUsersList: vtuberUsers
    });
    
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ error: 'Test failed', details: error.message });
  }
});

// Simplified test endpoint for /api/users/vote
app.get('/api/test/users-vote', async (req, res) => {
  try {
    console.log('=== Simplified /api/users/vote test ===');
    const { badge } = req.query;
    console.log('Query badge:', badge);
    
    let filter = {};
    if (badge) {
      filter.badges = { $in: [badge] };
    }
    
    console.log('Filter:', JSON.stringify(filter));
    
    const users = await User.find(filter).select('username badges').limit(5);
    console.log('Found users:', users.length);
    
    res.json({
      success: true,
      badge: badge,
      filter: filter,
      userCount: users.length,
      users: users
    });
    
  } catch (error) {
    console.error('Simplified test error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Get all VTubers (users with vtuber badge)
app.get('/api/vtubers', async (req, res) => {
  try {
    const vtubers = await User.find({ badges: { $in: ['vtuber'] } })
      .select('username avatar bio vote_bio badge badges vtuber_description artist_description facebook website')
      .sort({ username: 1 });

    res.json({
      vtubers
    });

  } catch (error) {
    console.error('Get VTubers error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get all users for voting (with optional badge filter) - SAFE VERSION
app.get('/api/users/vote', async (req, res) => {
  try {
    console.log('=== /api/users/vote API called (SAFE VERSION) ===');
    const { badge } = req.query;
    console.log('Query badge parameter:', badge);
    
    // Get all users first (safe approach)
    let allUsers = [];
    try {
      allUsers = await User.find({})
        .select('username avatar bio vote_bio badge badges vtuber_description artist_description facebook website')
        .sort({ username: 1 });
      console.log('Successfully fetched all users:', allUsers.length);
    } catch (dbError) {
      console.error('Database query failed:', dbError.message);
      return res.json({ users: [] }); // Return empty array instead of error
    }
    
    // If no badge filter, return all users
    if (!badge) {
      console.log('No badge filter - returning all users');
      return res.json({ users: allUsers });
    }
    
    // Filter users by badge using JavaScript (safer than MongoDB query)
    console.log(`Filtering users for badge: ${badge}`);
    const filteredUsers = allUsers.filter(user => {
      // Handle different badge field scenarios
      if (user.badges && Array.isArray(user.badges)) {
        return user.badges.includes(badge);
      }
      
      // Fallback: check old 'badge' field
      if (user.badge && user.badge === badge) {
        return true;
      }
      
      // Fallback: check if badges is a string
      if (user.badges && typeof user.badges === 'string' && user.badges === badge) {
        return true;
      }
      
      return false;
    });
    
    console.log(`Found ${filteredUsers.length} users with badge '${badge}'`);
    
    // Log sample users for debugging
    if (filteredUsers.length > 0) {
      console.log('Sample filtered users:', filteredUsers.slice(0, 3).map(u => ({
        username: u.username,
        badges: u.badges,
        badge: u.badge
      })));
    }
    
    res.json({
      users: filteredUsers
    });

  } catch (error) {
    console.error('=== /api/users/vote ERROR (SAFE VERSION) ===');
    console.error('Error message:', error.message);
    
    // Return empty array instead of 500 error
    res.json({ 
      users: [],
      error: 'Tạm thời không thể tải danh sách user',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/feedback - Save feedback
app.post('/api/feedback', authenticateToken, async (req, res) => {
  try {
    const { message, name, email, subject } = req.body;
    if (!message || !name || !email || !subject || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Thông tin feedback không hợp lệ' });
    }
    const user = await User.findById(req.user.id);
    const feedback = await Feedback.create({
      user_id: user._id,
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim()
    });
    res.status(201).json({ message: 'Gửi feedback thành công', feedback });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});
// GET /api/feedback - Get all feedback (admin email only)
app.get('/api/feedback', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.email !== 'huynguyen86297@gmail.com') {
      return res.status(403).json({ error: 'Không có quyền truy cập feedback' });
    }
    const feedbacks = await Feedback.find({}).sort({ created_at: -1 }).populate('user_id', 'username email avatar');
    res.json({ feedbacks });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// DELETE /api/feedback/:id - Admin delete feedback
app.delete('/api/feedback/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.email !== 'huynguyen86297@gmail.com') {
      return res.status(403).json({ error: 'Không có quyền xóa feedback' });
    }
    const feedback = await Feedback.findByIdAndDelete(req.params.id);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback không tồn tại' });
    }
    res.json({ message: 'Đã xóa feedback thành công' });
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