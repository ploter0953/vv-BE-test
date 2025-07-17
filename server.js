require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const userRoutes = require('./routes/userRoutes');
const commissionRoutes = require('./routes/commissionRoutes');
const orderRoutes = require('./routes/orderRoutes');
const User = require('./models/User');
const Commission = require('./models/Commission');
const Order = require('./models/Order');
const Vote = require('./models/Vote');
const Feedback = require('./models/Feedback');
const { requireAuth } = require('@clerk/express');

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

// Middleware xác thực Clerk
// const clerkMiddleware = clerkExpressWithAuth({ secretKey: process.env.CLERK_SECRET_KEY });

// Example usage for protected routes:
// app.use('/api/orders', clerkMiddleware);
// app.use('/api/commissions', clerkMiddleware);
// app.use('/api/upload', clerkMiddleware);
// app.use('/api/vote', clerkMiddleware);
// app.use('/api/feedback', clerkMiddleware);
// app.use('/api/users', clerkMiddleware); // If you want to protect all user routes

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
  next();
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = getAllowedOrigins();
    
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

// Apply origin validation middleware to all API routes
app.use('/api', validateOrigin);

// Additional security: Check Referer header for API routes
app.use('/api', (req, res, next) => {
  const referer = req.headers.referer;
  const allowedOrigins = getAllowedOrigins();
  
  // Skip referer check for OPTIONS requests (preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }
  
  // Block requests without referer (direct API access)
  if (!referer) {
    console.log('No referer header - BLOCKING request (direct API access not allowed)');
    return res.status(403).json({
      error: 'Truy cập trực tiếp API không được phép',
      message: 'Vui lòng truy cập từ domain chính thức: https://www.projectvtuber.com'
    });
  }
  
  // Check if referer is from allowed domain
  const refererUrl = new URL(referer);
  const refererOrigin = refererUrl.origin;
  
  if (!allowedOrigins.includes(refererOrigin)) {
    console.log(`Referer ${refererOrigin} is NOT allowed - blocking request`);
    return res.status(403).json({
      error: 'Truy cập không được phép từ domain này',
      message: 'Vui lòng truy cập từ domain chính thức: https://www.projectvtuber.com'
    });
  }
  
  console.log(`Referer ${refererOrigin} is allowed`);
  next();
});

// Additional security: Block common API testing tools
app.use('/api', (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const blockedTools = [
    'postman',
    'insomnia',
    'curl',
    'wget',
    'python-requests',
    'axios',
    'fetch',
    'httpie',
    'thunder client',
    'rest client'
  ];
  
  // Skip for OPTIONS requests
  if (req.method === 'OPTIONS') {
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
  
  next();
});

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

// Remove profile_email unique index - allow multiple users to have same profile_email
async function fixProfileEmailIndex() {
  try {
    // Drop the existing unique index on profile_email
    await User.collection.dropIndex('profile_email_1');
    console.log('Dropped existing profile_email unique index');
  } catch (error) {
    // Index might not exist, which is fine
    console.log('Profile_email unique index does not exist or already dropped');
  }
  
  try {
    // Create a regular index (not unique) for better query performance
    await User.collection.createIndex({ profile_email: 1 });
    console.log('Created regular index on profile_email (non-unique)');
  } catch (error) {
    console.log('Profile_email index already exists or error:', error.message);
  }
}

// Call the fix function when the app starts
fixProfileEmailIndex();

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

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Test endpoint for commissions
app.get('/api/test/commissions', async (req, res) => {
  try {
    console.log('Testing commission data...');
    
    // Get raw commission count
    const count = await Commission.countDocuments();
    console.log('Total commissions in database:', count);
    
    // Get a sample commission
    const sampleCommission = await Commission.findOne().lean();
    console.log('Sample commission:', sampleCommission);
    
    res.json({ 
      message: 'Commission test successful',
      totalCount: count,
      sampleCommission: sampleCommission
    });
  } catch (error) {
    console.error('Commission test error:', error);
    res.status(500).json({ error: 'Commission test failed: ' + error.message });
  }
});

// Clerk sync endpoint from userRoutes.js
app.post('/api/users/clerk-sync', requireAuth(), async (req, res) => {
  try {
    const { clerkId, email, username, avatar } = req.body;
    if (!clerkId || !email) {
      return res.status(400).json({ error: 'clerkId và email là bắt buộc' });
    }
    let user = await User.findOne({ clerkId });
    if (user) {
      // Đã có user, trả về profile
      return res.json({
        user,
        message: 'User đã tồn tại, trả về profile.'
      });
    }
    // Nếu chưa có, tạo mới user với các trường mặc định
    user = await User.create({
      clerkId,
      email,
      username: username || '',
      avatar: avatar || '',
      badges: ['member'],
      bio: '',
      description: '',
      facebook: '',
      website: '',
      profile_email: '',
      vtuber_description: '',
      artist_description: ''
    });
    return res.status(201).json({
      user,
      message: 'Tạo user mới thành công.'
    });
  } catch (error) {
    console.error('Clerk sync error:', error);
    res.status(500).json({ error: 'Lỗi server khi đồng bộ user với Clerk.' });
  }
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

// Get all users (for artist profiles)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({});
    res.json({ users });
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get users for voting (with optional badge filter) - MUST BE BEFORE /api/users/:id
app.get('/api/users/vote', async (req, res) => {
  try {
    console.log('--- /api/users/vote called ---');
    console.log('Query params:', req.query);
    console.log('Request headers:', req.headers);
    
    // Check if User model exists
    console.log('User model exists:', !!User);
    console.log('User model:', User);
    
    const { badge } = req.query;
    let query = {};
    
    // Always filter by badges - if no badge specified, show users with any badge
    if (badge) {
      if (badge === 'vtuber') {
        query.badges = { $in: ['vtuber'] };
      } else if (badge === 'artist') {
        query.badges = { $in: ['verified'] };
      }
    } else {
      // If no badge filter, only show users who have either 'vtuber' or 'verified' badge
      query.badges = { $in: ['vtuber', 'verified'] };
    }
    
    console.log('MongoDB query object:', JSON.stringify(query));
    console.log('Mongoose connection readyState:', mongoose.connection.readyState);
    console.log('Mongoose connection name:', mongoose.connection.name);
    console.log('Mongoose connection host:', mongoose.connection.host);
    
    if (!mongoose.connection.readyState) {
      console.error('Database not connected');
      return res.status(500).json({ error: 'Database connection error' });
    }
    
    // Test basic User.find() first
    console.log('Testing basic User.find()...');
    const allUsers = await User.find({}).limit(1);
    console.log('Basic User.find() result:', allUsers.length, 'users found');
    
    console.log('Executing main query...');
    const users = await User.find(query)
      .select('username avatar bio badges vtuber_description artist_description')
      .sort({ username: 1 });
    
    console.log(`Found ${users.length} users for voting`);
    
    if (users.length > 0) {
      console.log('Sample user:', JSON.stringify(users[0], null, 2));
    } else {
      console.log('No users found for this query.');
    }
    
    res.json({ users });
    
  } catch (error) {
    console.error('=== /api/users/vote ERROR ===');
    console.error('Error object:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error.constructor.name);
    
    if (error && error.stack) {
      console.error('Error stack:', error.stack);
    }
    if (error && error.name) {
      console.error('Error name:', error.name);
    }
    if (error && error.message) {
      console.error('Error message:', error.message);
    }
    if (error && error.code) {
      console.error('Error code:', error.code);
    }
    
    res.status(500).json({ 
      error: 'Lỗi server', 
      details: error.message,
      name: error.name,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
app.put('/api/users/:id', requireAuth(), async (req, res) => {
  const userId = req.params.id;
  const { avatar, bio, facebook, zalo, phone, website, profile_email, vtuber_description, artist_description, description } = req.body;

  console.log('Profile update request:', { userId, userFromToken: req.auth.userId, body: req.body });

  // Tìm user theo _id hoặc clerkId
  let user = null;
  try {
    user = await User.findById(userId);
  } catch (e) {
    // Nếu userId không phải ObjectId, bỏ qua lỗi
  }
  if (!user) {
    user = await User.findOne({ clerkId: userId });
  }
  if (!user) {
    console.log('User not found:', userId);
    return res.status(404).json({ error: 'Người dùng không tồn tại' });
  }

  // Cho phép cập nhật nếu user._id == req.auth.userId hoặc user.clerkId == req.auth.userId
  if (user._id.toString() !== req.auth.userId && user.clerkId !== req.auth.userId) {
    console.log('Permission denied: userId', userId, 'userFromToken', req.auth.userId);
    return res.status(403).json({ error: 'Không có quyền cập nhật profile này' });
  }

  try {
    // Validate bio length (max 50 characters)
    if (bio && bio.length > 50) {
      return res.status(400).json({ error: 'Bio không được vượt quá 50 ký tự' });
    }

    // Update user fields
    const updateData = {
      avatar: avatar || user.avatar,
      bio: bio || user.bio,
      description: description || user.description,
      facebook: facebook || user.facebook,
      zalo: zalo || user.zalo,
      phone: phone || user.phone,
      website: website || user.website,
      profile_email: profile_email || user.profile_email,
      vtuber_description: vtuber_description || user.vtuber_description,
      artist_description: artist_description || user.artist_description
    };

    // Ghi log chi tiết trước khi cập nhật
    console.log('[PROFILE UPDATE] User', userId, 'is updating profile. Old data:', user.toObject());
    console.log('[PROFILE UPDATE] New data:', updateData);

    const updatedUser = await User.findByIdAndUpdate(user._id, updateData, { new: true, runValidators: true });
    if (!updatedUser) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }
    console.log('Profile updated successfully for user:', userId);
    res.json({ message: 'Cập nhật profile thành công' });
  } catch (error) {
    console.error('[PROFILE UPDATE ERROR] Lỗi khi cập nhật profile cho user', userId, ':', error);
    if (error.code === 11000) {
      console.error('Unexpected duplicate key error:', error);
      return res.status(500).json({ error: 'Lỗi database không mong muốn. Vui lòng thử lại.' });
    }
    res.status(500).json({ error: 'Lỗi khi cập nhật profile: ' + error.message });
  }
});

// Commission routes are now handled by commissionRoutes.js

// Confirm order (artist confirms)
app.put('/api/orders/:id/confirm', requireAuth(), async (req, res) => {
  console.log('=== ARTIST CONFIRM ORDER ===');
  console.log('Order ID:', req.params.id);
  console.log('User ID:', req.auth.userId);
  console.log('Request body:', req.body);
  
  try {
    const order = await Order.findById(req.params.id).populate('commission');
    console.log('Found order:', order ? {
      id: order._id,
      status: order.status,
      buyer: order.buyer,
      commission_user: order.commission?.user
    } : 'NOT FOUND');   
    if (!order) {
      console.log('Order not found');
      return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
    }
    
    // Check if user is the commission owner (artist)
    const isArtist = order.commission.user === req.auth.userId;
    console.log('Is user the artist?', isArtist);
    console.log('Order commission user:', order.commission.user);
    console.log('Request user ID:', req.auth.userId);
    
    if (!isArtist) {
      console.log('User is not the artist - FORBIDDEN');
      return res.status(403).json({ error: 'Không có quyền xác nhận đơn hàng này' });
    }
    
    console.log('Current order status:', order.status);
    if (order.status !== 'pending') {
      console.log('Order status is not pending - BAD REQUEST');
      return res.status(400).json({ error: 'Đơn hàng đã được xử lý' });
    }
    
    order.status = 'confirmed';
    order.confirmed_at = new Date();
    await order.save();
    console.log('Order status updated to confirmed');
    
    // Update commission status
    const commission = order.commission;
    commission.status = 'in_progress';
    await commission.save();
    console.log('Commission status updated to in_progress');
    
    console.log('=== ARTIST CONFIRM ORDER SUCCESS ===');
    res.json({ message: 'Xác nhận đơn hàng thành công' });
  } catch (error) {
    console.error('=== ARTIST CONFIRM ORDER ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Complete order (artist marks as completed)
app.put('/api/orders/:id/complete', requireAuth(), async (req, res) => {
  console.log('=== ARTIST COMPLETE ORDER ===');
  console.log('Order ID:', req.params.id);
  console.log('User ID:', req.auth.userId);
  console.log('Request body:', req.body);
  
  try {
    const order = await Order.findById(req.params.id).populate('commission');
    console.log('Found order:', order ? {
      id: order._id,
      status: order.status,
      buyer: order.buyer,
      commission_user: order.commission?.user
    } : 'NOT FOUND');   
    if (!order) {
      console.log('Order not found');
      return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
    }
    
    // Check if user is the commission owner (artist)
    const isArtist = order.commission.user === req.auth.userId;
    console.log('Is user the artist?', isArtist);
    console.log('Order commission user:', order.commission.user);
    console.log('Request user ID:', req.auth.userId);
    
    if (!isArtist) {
      console.log('User is not the artist - FORBIDDEN');
      return res.status(403).json({ error: 'Không có quyền hoàn thành đơn hàng này' });
    }
    
    console.log('Current order status:', order.status);
    if (!['confirmed', 'customer_rejected', 'in_progress'].includes(order.status)) {
      console.log('Order status not allowed for completion - BAD REQUEST');
      return res.status(400).json({ error: 'Đơn hàng chưa được xác nhận hoặc không thể hoàn thành' });
    }
    
    order.status = 'waiting_customer_confirmation';
    order.completed_at = new Date();
    await order.save();
    console.log('Order status updated to waiting_customer_confirmation');
    
    // Update commission status
    const commission = order.commission;
    commission.status = 'waiting_customer_confirmation';
    await commission.save();
    console.log('Commission status updated to waiting_customer_confirmation');
    
    console.log('=== ARTIST COMPLETE ORDER SUCCESS ===');
    res.json({ message: 'Đã đánh dấu hoàn thành. Chờ khách hàng xác nhận để hoàn tất đơn hàng.', requiresCustomerConfirmation: true });
  } catch (error) {
    console.error('=== ARTIST COMPLETE ORDER ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Customer confirms completion
app.put('/api/orders/:id/customer-confirm', requireAuth(), async (req, res) => {
  console.log('=== CUSTOMER CONFIRM ORDER ===');
  console.log('Order ID:', req.params.id);
  console.log('User ID:', req.auth.userId);
  console.log('Request body:', req.body);
  
  try {
    const order = await Order.findById(req.params.id).populate('commission');
    console.log('Found order:', order ? {
      id: order._id,
      status: order.status,
      buyer: order.buyer,
      commission_user: order.commission?.user
    } : 'NOT FOUND');   
    if (!order) {
      console.log('Order not found');
      return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
    }
    
    // Check if user is the buyer (customer)
    const isCustomer = order.buyer === req.auth.userId;
    console.log('Is user the customer?', isCustomer);
    console.log('Order buyer:', order.buyer);
    console.log('Request user ID:', req.auth.userId);
    
    if (!isCustomer) {
      console.log('User is not the customer - FORBIDDEN');
      return res.status(403).json({ error: 'Không có quyền xác nhận đơn hàng này' });
    }
    
    console.log('Current order status:', order.status);
    if (order.status !== 'waiting_customer_confirmation') {
      console.log('Order status not waiting for customer confirmation - BAD REQUEST');
      return res.status(400).json({ error: 'Đơn hàng chưa sẵn sàng để xác nhận' });
    }
    
    order.status = 'completed';
    order.customer_confirmed = true;
    await order.save();
    console.log('Order status updated to completed');
    
    // Update commission status
    const commission = order.commission;
    commission.status = 'completed';
    await commission.save();
    console.log('Commission status updated to completed');
    
    console.log('=== CUSTOMER CONFIRM ORDER SUCCESS ===');
    res.json({ message: 'Xác nhận hoàn thành thành công. Đơn hàng đã hoàn tất!' });
  } catch (error) {
    console.error('=== CUSTOMER CONFIRM ORDER ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Customer cancels order
app.put('/api/orders/:id/cancel', requireAuth(), async (req, res) => {
  console.log('=== CUSTOMER CANCEL ORDER ===');
  console.log('Order ID:', req.params.id);
  console.log('User ID:', req.auth.userId);
  console.log('Request body:', req.body);
  
  try {
    const order = await Order.findById(req.params.id).populate('commission');
    console.log('Found order:', order ? {
      id: order._id,
      status: order.status,
      buyer: order.buyer,
      commission_user: order.commission?.user
    } : 'NOT FOUND');   
    if (!order) {
      console.log('Order not found');
      return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
    }
    
    // Check if user is the buyer (customer)
    const isCustomer = order.buyer === req.auth.userId;
    console.log('Is user the customer?', isCustomer);
    console.log('Order buyer:', order.buyer);
    console.log('Request user ID:', req.auth.userId);
    
    if (!isCustomer) {
      console.log('User is not the customer - FORBIDDEN');
      return res.status(403).json({ error: 'Không có quyền hủy đơn hàng này' });
    }
    
    console.log('Current order status:', order.status);
    if (order.status !== 'pending') {
      console.log('Order status not pending - BAD REQUEST');
      return res.status(400).json({ error: 'Không thể hủy đơn hàng đã được xác nhận hoặc đang thực hiện' });
    }
    
    order.status = 'cancelled';
    await order.save();
    console.log('Order status updated to cancelled');
    
    // Nếu không còn active order nào thì mở lại commission
    const activeOrders = await Order.countDocuments({ 
      commission: order.commission._id, 
      status: { $in: ['pending', 'confirmed', 'waiting_customer_confirmation', 'customer_rejected'] } 
    });
    console.log('Active orders count:', activeOrders);
    
    if (activeOrders === 0) {
      const commission = order.commission;
      commission.status = 'open';
      await commission.save();
      console.log('Commission status updated to open (no active orders)');
    }
    
    console.log('=== CUSTOMER CANCEL ORDER SUCCESS ===');
    res.json({ message: 'Hủy đơn hàng thành công' });
  } catch (error) {
    console.error('=== CUSTOMER CANCEL ORDER ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Customer rejects completion
app.put('/api/orders/:id/reject', requireAuth(), async (req, res) => {
  console.log('=== CUSTOMER REJECT ORDER ===');
  console.log('Order ID:', req.params.id);
  console.log('User ID:', req.auth.userId);
  console.log('Request body:', req.body);
  
  try {
    const { rejection_reason } = req.body;
    console.log('Rejection reason:', rejection_reason);
    
    const order = await Order.findById(req.params.id).populate('commission');
    console.log('Found order:', order ? {
      id: order._id,
      status: order.status,
      buyer: order.buyer,
      commission_user: order.commission?.user
    } : 'NOT FOUND');   
    if (!order) {
      console.log('Order not found');
      return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
    }
    
    // Check if user is the buyer (customer)
    const isCustomer = order.buyer === req.auth.userId;
    console.log('Is user the customer?', isCustomer);
    console.log('Order buyer:', order.buyer);
    console.log('Request user ID:', req.auth.userId);
    
    if (!isCustomer) {
      console.log('User is not the customer - FORBIDDEN');
      return res.status(403).json({ error: 'Không có quyền từ chối đơn hàng này' });
    }
    
    console.log('Current order status:', order.status);
    if (order.status !== 'waiting_customer_confirmation') {
      console.log('Order status not waiting for customer confirmation - BAD REQUEST');
      return res.status(400).json({ error: 'Đơn hàng chưa sẵn sàng để từ chối' });
    }
    
    order.status = 'customer_rejected';
    order.rejection_reason = rejection_reason || 'Khách hàng từ chối xác nhận hoàn thành';
    await order.save();
    console.log('Order status updated to customer_rejected');
    console.log('Rejection reason saved:', order.rejection_reason);
    
    // Update commission status
    const commission = order.commission;
    commission.status = 'in_progress';
    await commission.save();
    console.log('Commission status updated to in_progress');
    
    console.log('=== CUSTOMER REJECT ORDER SUCCESS ===');
    res.json({ message: 'Đã từ chối xác nhận hoàn thành. Artist sẽ được thông báo để chỉnh sửa.' });
  } catch (error) {
    console.error('=== CUSTOMER REJECT ORDER ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Artist rejects order
app.put('/api/orders/:id/artist-reject', requireAuth(), async (req, res) => {
  console.log('=== ARTIST REJECT ORDER ===');
  console.log('Order ID:', req.params.id);
  console.log('User ID:', req.auth.userId);
  console.log('Request body:', req.body);
  
  try {
    const { rejection_reason } = req.body;
    console.log('Rejection reason:', rejection_reason);
    
    const order = await Order.findById(req.params.id).populate('commission');
    console.log('Found order:', order ? {
      id: order._id,
      status: order.status,
      buyer: order.buyer,
      commission_user: order.commission?.user
    } : 'NOT FOUND');   
    if (!order) {
      console.log('Order not found');
      return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
    }
    
    // Check if user is the commission owner (artist)
    const isArtist = order.commission.user === req.auth.userId;
    console.log('Is user the artist?', isArtist);
    console.log('Order commission user:', order.commission.user);
    console.log('Request user ID:', req.auth.userId);
    
    if (!isArtist) {
      console.log('User is not the artist - FORBIDDEN');
      return res.status(403).json({ error: 'Không có quyền từ chối đơn hàng này' });
    }
    
    console.log('Current order status:', order.status);
    // Allow artist to reject in pending, confirmed, in_progress, waiting_customer_confirmation, or customer_rejected
    if (!["pending", "confirmed", "in_progress", "waiting_customer_confirmation", "customer_rejected"].includes(order.status)) {
      console.log('Order status not allowed for artist rejection - BAD REQUEST');
      return res.status(400).json({ error: 'Không thể từ chối đơn hàng ở trạng thái này' });
    }
    
    order.status = 'artist_rejected';
    order.rejection_reason = rejection_reason || 'Artist từ chối thực hiện đơn hàng';
    await order.save();
    console.log('Order status updated to artist_rejected');
    console.log('Rejection reason saved:', order.rejection_reason);
    
    // Check if commission should be reopened
    const activeOrders = await Order.countDocuments({ 
      commission: order.commission._id, 
      status: { $in: ['pending', 'confirmed', 'waiting_customer_confirmation', 'customer_rejected'] } 
    });
    console.log('Active orders count:', activeOrders);
    
    if (activeOrders === 0) {
      const commission = order.commission;
      commission.status = 'open';
      await commission.save();
      console.log('Commission status updated to open (no active orders)');
    }
    
    console.log('=== ARTIST REJECT ORDER SUCCESS ===');
    res.json({ message: 'Đã từ chối đơn hàng. Commission sẽ được mở lại nếu không còn đơn hàng nào.' });
  } catch (error) {
    console.error('=== ARTIST REJECT ORDER ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
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

// Upload image to Cloudinary
app.post('/api/upload/image', requireAuth(), upload.single('image'), async (req, res) => {
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
app.post('/api/upload/images', requireAuth(), upload.array('images', 10), async (req, res) => {
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
app.delete('/api/upload/image/:public_id', requireAuth(), async (req, res) => {
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
app.delete('/api/upload/image-by-url', requireAuth(), async (req, res) => {
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
app.post('/api/vote/vtuber', requireAuth(), async (req, res) => {
  try {
    const { voted_vtuber_id } = req.body;
    const voter_id = req.auth.userId;

    if (!voted_vtuber_id) {
      return res.status(400).json({ error: 'Vui lòng chọn VTuber để vote' });
    }

    // Check if voted user exists and has VTuber badge
    let votedUser = null;
    try {
      votedUser = await User.findById(voted_vtuber_id);
    } catch (e) {}
    if (!votedUser) {
      votedUser = await User.findOne({ clerkId: voted_vtuber_id });
    }
    if (!votedUser) {
      return res.status(404).json({ error: 'VTuber không tồn tại' });
    }

    if (!votedUser.badges || !votedUser.badges.includes('vtuber')) {
      return res.status(400).json({ error: 'Chỉ có thể vote cho user có badge VTuber' });
    }

    // Check if voter is trying to vote for themselves (so sánh với cả _id và clerkId)
    if (voter_id === votedUser._id.toString() || voter_id === votedUser.clerkId) {
      return res.status(400).json({ error: 'Không thể vote cho chính mình' });
    }

    // Check if user has already voted today for VTuber
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingVote = await Vote.findOne({
      voter_id,
      vote_type: 'vtuber',
      created_at: {
        $gte: today,
        $lt: tomorrow
      }
    });

    if (existingVote) {
      return res.status(400).json({ error: 'Bạn đã vote VTuber hôm nay. Vui lòng thử lại vào ngày mai' });
    }

    // Create new vote
    const newVote = await Vote.create({
      voter_id,
      voted_vtuber_id: votedUser._id,
      vote_type: 'vtuber',
      created_at: new Date()
    });

    res.status(201).json({
      message: 'Vote VTuber thành công!',
      vote: newVote
    });

  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Vote for an Artist (1 vote per day per user)
app.post('/api/vote/artist', requireAuth(), async (req, res) => {
  try {
    const { voted_artist_id } = req.body;
    const voter_id = req.auth.userId;

    if (!voted_artist_id) {
      return res.status(400).json({ error: 'Vui lòng chọn Artist để vote' });
    }

    // Check if voted user exists and has Artist badge
    let votedUser = null;
    try {
      votedUser = await User.findById(voted_artist_id);
    } catch (e) {}
    if (!votedUser) {
      votedUser = await User.findOne({ clerkId: voted_artist_id });
    }
    if (!votedUser) {
      return res.status(404).json({ error: 'Artist không tồn tại' });
    }

    const validArtistBadges = ['verified', 'trusted', 'quality', 'partner'];
    if (!votedUser.badges || !votedUser.badges.some(badge => validArtistBadges.includes(badge))) {
      return res.status(400).json({ error: 'Chỉ có thể vote cho user có badge Artist hợp lệ' });
    }

    // Check if voter is trying to vote for themselves (so sánh với cả _id và clerkId)
    if (voter_id === votedUser._id.toString() || voter_id === votedUser.clerkId) {
      return res.status(400).json({ error: 'Không thể vote cho chính mình' });
    }

    // Check if user has already voted today for Artist
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingVote = await Vote.findOne({
      voter_id,
      vote_type: 'artist',
      created_at: {
        $gte: today,
        $lt: tomorrow
      }
    });

    if (existingVote) {
      return res.status(400).json({ error: 'Bạn đã vote Artist hôm nay. Vui lòng thử lại vào ngày mai' });
    }

    // Create new vote
    const newVote = await Vote.create({
      voter_id,
      voted_artist_id: votedUser._id,
      vote_type: 'artist',
      created_at: new Date()
    });

    res.status(201).json({
      message: 'Vote Artist thành công!',
      vote: newVote
    });

  } catch (error) {
    console.error('Vote artist error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get VTuber spotlight (top 5 VTubers by votes)
app.get('/api/spotlight/vtubers', async (req, res) => {
  try {
    // Get top 5 VTubers by vote count
    const topVTubers = await Vote.aggregate([
      {
        $match: {
          vote_type: 'vtuber',
          voted_vtuber_id: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$voted_vtuber_id',
          voteCount: { $sum: 1 }
        }
      },
      {
        $sort: { voteCount: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'vtuber'
        }
      },
      {
        $unwind: '$vtuber'
      },
      {
        $match: {
          'vtuber.badges': { $in: ['vtuber'] }
        }
      },
      {
        $project: {
          _id: '$vtuber._id',
          voteCount: 1,
          username: '$vtuber.username',
          avatar: '$vtuber.avatar',
          bio: '$vtuber.bio',
          vtuber_description: '$vtuber.vtuber_description',
          badges: '$vtuber.badges'
        }
      }
    ]);

    res.json({
      spotlight: topVTubers
    });

  } catch (error) {
    console.error('Spotlight error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get Artist spotlight (top 5 Artists by votes)
app.get('/api/spotlight/artists', async (req, res) => {
  try {
    // Get top 5 Artists by vote count
    const topArtists = await Vote.aggregate([
      {
        $match: {
          vote_type: 'artist',
          voted_artist_id: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$voted_artist_id',
          voteCount: { $sum: 1 }
        }
      },
      {
        $sort: { voteCount: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'artist'
        }
      },
      {
        $unwind: '$artist'
      },
      {
        $match: {
          'artist.badges': { $in: ['verified', 'trusted', 'quality', 'partner'] }
        }
      },
      {
        $project: {
          _id: '$artist._id',
          voteCount: 1,
          username: '$artist.username',
          avatar: '$artist.avatar',
          bio: '$artist.bio',
          artist_description: '$artist.artist_description',
          badges: '$artist.badges'
        }
      }
    ]);

    res.json({
      spotlight: topArtists
    });

  } catch (error) {
    console.error('Spotlight artists error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get user's vote status for today
app.get('/api/vote/status', requireAuth(), async (req, res) => {
  try {
    const voter_id = req.auth.userId;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's votes for both VTuber and Artist
    const todayVotes = await Vote.find({
      voter_id,
      created_at: {
        $gte: today,
        $lt: tomorrow
      }
    }).populate('voted_vtuber_id voted_artist_id', 'username avatar');

    const vtuberVote = todayVotes.find(vote => vote.vote_type === 'vtuber');
    const artistVote = todayVotes.find(vote => vote.vote_type === 'artist');

    res.json({
      vtuber: {
        hasVotedToday: !!vtuberVote,
        todayVote: vtuberVote ? {
          voted_user: vtuberVote.voted_vtuber_id,
          created_at: vtuberVote.created_at
        } : null
      },
      artist: {
        hasVotedToday: !!artistVote,
        todayVote: artistVote ? {
          voted_user: artistVote.voted_artist_id,
          created_at: artistVote.created_at
        } : null
      }
    });

  } catch (error) {
    console.error('Vote status error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get all VTubers (users with vtuber badge)
app.get('/api/vtubers', async (req, res) => {
  try {
    const vtubers = await User.find({ badges: { $in: ['vtuber'] } })
      .select('username avatar bio')
      .sort({ username: 1 });

    res.json({
      vtubers
    });

  } catch (error) {
    console.error('Get VTubers error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Feedback endpoints
app.post('/api/feedback', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Tất cả các trường đều bắt buộc' });
    }

    const feedback = await Feedback.create({
      name,
      email,
      subject,
      message,
      created_at: new Date()
    });

    res.status(201).json({
      message: 'Feedback đã được gửi thành công',
      feedback
    });

  } catch (error) {
    console.error('Feedback creation error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.get('/api/feedback', requireAuth(), async (req, res) => {
  try {
    // Only admin can view all feedback
    const user = await User.findById(req.auth.userId);
    if (!user || user.email !== 'huynguyen86297@gmail.com') {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }

    const feedbacks = await Feedback.find()
      .populate('user_id', 'username avatar')
      .sort({ created_at: -1 });

    res.json({
      feedbacks
    });

  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.delete('/api/feedback/:id', requireAuth(), async (req, res) => {
  try {
    // Only admin can delete feedback
    const user = await User.findById(req.auth.userId);
    if (!user || user.email !== 'huynguyen86297@gmail.com') {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }

    const feedback = await Feedback.findByIdAndDelete(req.params.id);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback không tồn tại' });
    }

    res.json({
      message: 'Feedback đã được xóa thành công'
    });

  } catch (error) {
    console.error('Delete feedback error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Test endpoint for User model
app.get('/api/test/users', async (req, res) => {
  try {
    console.log('=== /api/test/users called ===');
    console.log('User model exists:', !!User);
    console.log('Mongoose connection readyState:', mongoose.connection.readyState);
    
    if (!mongoose.connection.readyState) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    // Test simple count
    const count = await User.countDocuments();
    console.log('Total users in database:', count);
    
    // Test simple find
    const users = await User.find({}).limit(3).select('username email');
    console.log('Sample users:', users);
    
    res.json({
      message: 'User model test successful',
      totalUsers: count,
      sampleUsers: users,
      connectionState: mongoose.connection.readyState
    });
    
  } catch (error) {
    console.error('User model test error:', error);
    res.status(500).json({ 
      error: 'User model test failed', 
      details: error.message,
      name: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Test endpoint for commissions
app.get('/api/test/commissions', async (req, res) => {
  try {
    console.log('Testing commission data...');
    
    // Get raw commission count
    const count = await Commission.countDocuments();
    console.log('Total commissions in database:', count);
    
    // Get a sample commission
    const sampleCommission = await Commission.findOne().lean();
    console.log('Sample commission:', sampleCommission);
    
    res.json({ 
      message: 'Commission test successful',
      totalCount: count,
      sampleCommission: sampleCommission
    });
  } catch (error) {
    console.error('Commission test error:', error);
    res.status(500).json({ error: 'Commission test failed: ' + error.message });
  }
});

// Clerk sync endpoint from userRoutes.js
app.post('/api/users/clerk-sync', async (req, res) => {
  try {
    const { clerkId, email, username, avatar } = req.body;
    if (!clerkId || !email) {
      return res.status(400).json({ error: 'clerkId và email là bắt buộc' });
    }
    let user = await User.findOne({ clerkId });
    if (user) {
      // Đã có user, trả về profile
      return res.json({
        user,
        message: 'User đã tồn tại, trả về profile.'
      });
    }
    // Nếu chưa có, tạo mới user với các trường mặc định
    user = await User.create({
      clerkId,
      email,
      username: username || '',
      avatar: avatar || '',
      badges: ['member'],
      bio: '',
      description: '',
      facebook: '',
      website: '',
      profile_email: '',
      vtuber_description: '',
      artist_description: ''
    });
    return res.status(201).json({
      user,
      message: 'Tạo user mới thành công.'
    });
  } catch (error) {
    console.error('Clerk sync error:', error);
    res.status(500).json({ error: 'Lỗi server khi đồng bộ user với Clerk.' });
  }
});

// Mount userRoutes (ưu tiên /clerk/:clerkId trước /:id)
app.use('/api/users', require('./routes/userRoutes'));

// Mount commissionRoutes
app.use('/api/commissions', require('./routes/commissionRoutes'));

// Mount orderRoutes
app.use('/api/orders', require('./routes/orderRoutes'));

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
  console.log(`CORS Enabled with security restrictions`);
}); 