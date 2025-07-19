const express = require('express');
const Commission = require('../models/Commission');
const User = require('../models/User');
const { requireAuth } = require('@clerk/express');
const Order = require('../models/Order'); // Đảm bảo đã require model Order
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose'); // Added for MongoDB connection check

const router = express.Router();

// Helper function to extract public_id from Cloudinary URL
function extractPublicIdFromCloudinaryUrl(url) {
  if (!url || !url.includes('cloudinary.com')) {
    return null;
  }
  
  try {
    // Cloudinary URL format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/filename.jpg
    const urlParts = url.split('/');
    const uploadIndex = urlParts.findIndex(part => part === 'upload');
    if (uploadIndex === -1) return null;
    
    // Get everything after 'upload/v1234567890/' or 'upload/'
    const pathAfterUpload = urlParts.slice(uploadIndex + 1);
    if (pathAfterUpload.length === 0) return null;
    
    // Skip version if present (starts with 'v' followed by numbers)
    const startIndex = pathAfterUpload[0].match(/^v\d+$/) ? 1 : 0;
    const publicIdParts = pathAfterUpload.slice(startIndex);
    
    // Join and remove file extension
    const publicId = publicIdParts.join('/').replace(/\.[^/.]+$/, '');
    return publicId;
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
}

// Helper function to delete files from Cloudinary
async function deleteCloudinaryFiles(urls) {
  const deletePromises = urls.map(async (url) => {
    try {
      const publicId = extractPublicIdFromCloudinaryUrl(url);
      if (publicId) {
        console.log('Deleting from Cloudinary:', publicId);
        const result = await cloudinary.uploader.destroy(publicId);
        console.log('Cloudinary delete result:', result);
        return { url, publicId, result };
      }
      return { url, publicId: null, result: 'no_public_id' };
    } catch (error) {
      console.error('Error deleting from Cloudinary:', error);
      return { url, error: error.message };
    }
  });
  
  return Promise.all(deletePromises);
}

// Delete image from Cloudinary
async function deleteFromCloudinary(publicId) {
  try {
    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.log('Cloudinary not configured, skipping delete');
      return null;
    }
    
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    return null;
  }
}

// Use requireAuth() for all protected routes:
// router.post('/', requireAuth(), ...)

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Commission routes are working!',
    timestamp: new Date().toISOString(),
    mongodbState: mongoose.connection.readyState
  });
});

// Create commission
router.post('/', requireAuth(), async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(500).json({ message: 'Database connection error' });
    }

    // Get user ID from Clerk auth or fallback
    const userId = req.auth?.userId || req.auth?.user?.id;
    
    if (!userId) {
      console.error('No user ID found in auth context');
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Try to find user by Clerk ID first, then by MongoDB ID
    let user = await User.findOne({ clerkId: userId });
    if (!user) {
      user = await User.findById(userId);
    }
    
    if (!user) {
      console.error('User not found for ID:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.facebook) {
      return res.status(400).json({ message: 'Bạn cần có link Facebook để tạo commission' });
    }

    // Extract data from request body
    const {
      title,
      description,
      type,
      price,
      currency,
      deadline,
      requirements,
      tags,
      'media-img': mediaImg,
      'media-vid': mediaVid
    } = req.body;

    // Create commission object
    const commission = new Commission({
      user: user._id, // Use MongoDB ObjectId
      title,
      description,
      type,
      price: Number(price),
      currency,
      deadline: new Date(deadline),
      requirements,
      tags,
      'media-img': mediaImg || [],
      'media-vid': mediaVid || [],
      status: 'open'
    });

    await commission.save();

    res.status(201).json({ 
      message: 'Commission created successfully',
      commission 
    });
  } catch (error) {
    console.error('Error creating commission:', error);
    res.status(500).json({ message: 'Error creating commission', error: error.message });
  }
});

// Get all commissions
router.get('/', async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(500).json({ message: 'Database connection error' });
    }

    const commissions = await Commission.find()
      .populate('user', 'username avatar bio')
      .sort({ createdAt: -1 });

    const processedCommissions = commissions.map(commission => {
      const commissionObj = commission.toObject();
      return {
        ...commissionObj,
        user: {
          _id: commissionObj.user._id,
          username: commissionObj.user.username,
          avatar: commissionObj.user.avatar,
          bio: commissionObj.user.bio
        }
      };
    });

    res.json({ commissions: processedCommissions });
  } catch (error) {
    console.error('Error fetching commissions:', error);
    res.status(500).json({ message: 'Error fetching commissions', error: error.message });
  }
});

// Get single commission
router.get('/:id', async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(500).json({ message: 'Database connection error' });
    }

    const commission = await Commission.findById(req.params.id)
      .populate('user', 'username avatar bio email');

    if (!commission) {
      return res.status(404).json({ message: 'Commission not found' });
    }

    const commissionObj = commission.toObject();
    const processedCommission = {
      ...commissionObj,
      user: {
        _id: commissionObj.user._id,
        username: commissionObj.user.username,
        avatar: commissionObj.user.avatar,
        bio: commissionObj.user.bio,
        email: commissionObj.user.email
      }
    };

    res.json({ commission: processedCommission });
  } catch (error) {
    console.error('Error fetching commission:', error);
    res.status(500).json({ message: 'Error fetching commission', error: error.message });
  }
});

// Update commission
router.put('/:id', requireAuth(), async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(500).json({ message: 'Database connection error' });
    }

    // Get user ID from Clerk auth or fallback
    const userId = req.auth?.userId || req.auth?.user?.id;
    
    if (!userId) {
      console.error('No user ID found in auth context');
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Try to find user by Clerk ID first, then by MongoDB ID
    let user = await User.findOne({ clerkId: userId });
    if (!user) {
      user = await User.findById(userId);
    }
    
    if (!user) {
      console.error('User not found for ID:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    const commission = await Commission.findOne({ 
      _id: req.params.id, 
      user: user._id // Use MongoDB ObjectId
    });

    if (!commission) {
      return res.status(404).json({ message: 'Commission not found or unauthorized' });
    }

    const updatedCommission = await Commission.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json({ 
      message: 'Commission updated successfully',
      commission: updatedCommission 
    });
  } catch (error) {
    console.error('Error updating commission:', error);
    res.status(500).json({ message: 'Error updating commission', error: error.message });
  }
});

// Xóa commission
router.delete('/:id', requireAuth(), async (req, res) => {
  console.log('=== DELETE COMMISSION ===');
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(500).json({ message: 'Database connection error' });
    }

    // Get user ID from Clerk auth or fallback
    const userId = req.auth?.userId || req.auth?.user?.id;
    
    if (!userId) {
      console.error('No user ID found in auth context');
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Try to find user by Clerk ID first, then by MongoDB ID
    let user = await User.findOne({ clerkId: userId });
    if (!user) {
      user = await User.findById(userId);
    }
    
    if (!user) {
      console.error('User not found for ID:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('User ID:', user._id, 'CommissionId:', req.params.id);
    
    const commission = await Commission.findById(req.params.id);
    if (!commission) return res.status(404).json({ message: 'Not found' });
    
    if (commission.user.toString() !== user._id.toString() && user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Delete media files from Cloudinary
    const mediaUrls = [
      ...(commission['media-img'] || []),
      ...(commission['media-vid'] || [])
    ];

    if (mediaUrls.length > 0) {
      const deletePromises = mediaUrls.map(url => deleteFromCloudinary(url));
      await Promise.all(deletePromises);
    }

    // Delete related orders
    await Order.deleteMany({ commission: req.params.id });
    
    await commission.deleteOne();
    res.json({ message: 'Commission deleted' });
    console.log('=== DELETE COMMISSION SUCCESS ===');
  } catch (err) {
    console.error('=== DELETE COMMISSION ERROR ===');
    console.error('Error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Create order for commission
router.post('/:id/order', requireAuth(), async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(500).json({ message: 'Database connection error' });
    }

    // Get user ID from Clerk auth or fallback
    const userId = req.auth?.userId || req.auth?.user?.id;
    
    if (!userId) {
      console.error('No user ID found in auth context');
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Try to find user by Clerk ID first, then by MongoDB ID
    let user = await User.findOne({ clerkId: userId });
    if (!user) {
      user = await User.findById(userId);
    }
    
    if (!user) {
      console.error('User not found for ID:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.facebook) {
      return res.status(400).json({ message: 'Bạn cần có link Facebook để đặt commission' });
    }

    const commission = await Commission.findById(req.params.id);
    if (!commission) {
      return res.status(404).json({ message: 'Commission not found' });
    }

    // Prevent users from ordering their own commission
    if (commission.user.toString() === user._id.toString()) {
      return res.status(400).json({ message: 'Bạn không thể đặt commission của chính mình' });
    }

    // Check if commission is open for orders
    if (commission.status !== 'open') {
      return res.status(400).json({ message: 'Commission không còn nhận đơn hàng' });
    }

    // Check if user already has an order for this commission
    const existingOrder = await Order.findOne({
      commission: req.params.id,
      customer: user._id
    });

    if (existingOrder) {
      return res.status(400).json({ message: 'Bạn đã đặt commission này rồi' });
    }

    // Create order
    const order = new Order({
      commission: req.params.id,
      customer: user._id,
      artist: commission.user,
      status: 'pending'
    });

    await order.save();

    res.status(201).json({ 
      message: 'Order created successfully',
      order 
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Error creating order', error: error.message });
  }
});

module.exports = router; 