const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const emailService = require('../services/emailService');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for email verification
const emailVerificationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // limit each IP to 3 requests per windowMs
  message: { message: 'Quá nhiều yêu cầu gửi mã. Vui lòng thử lại sau 5 phút.' }
});

// Rate limiting for registration
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { message: 'Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau 15 phút.' }
});

// Gửi mã xác minh email
router.post('/send-verification', emailVerificationLimiter, async (req, res) => {
  try {
    const { email, captchaToken } = req.body;

    if (!email || !captchaToken) {
      return res.status(400).json({ message: 'Email và captcha token là bắt buộc' });
    }

    // Verify captcha
    const captchaValid = await emailService.verifyCaptcha(captchaToken);
    if (!captchaValid) {
      return res.status(400).json({ message: 'Captcha không hợp lệ' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email đã được sử dụng' });
    }

    // Generate verification code
    const verificationCode = emailService.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store verification code temporarily (you might want to use Redis in production)
    // For now, we'll create a temporary user record
    const tempUser = new User({
      email,
      emailVerificationCode: verificationCode,
      emailVerificationExpires: expiresAt,
      username: 'temp_' + Date.now(), // temporary username
      password: 'temp_password' // temporary password
    });

    await tempUser.save();

    // Send verification email
    await emailService.sendVerificationEmail(email, verificationCode);

    res.json({ message: 'Mã xác minh đã được gửi đến email của bạn' });
  } catch (err) {
    console.error('Send verification error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Xác minh mã và đăng ký
router.post('/verify-and-register', registrationLimiter, async (req, res) => {
  try {
    const { username, email, password, verificationCode } = req.body;

    if (!username || !email || !password || !verificationCode) {
      return res.status(400).json({ message: 'Tất cả các trường là bắt buộc' });
    }

    // Find temporary user with verification code
    const tempUser = await User.findOne({
      email,
      emailVerificationCode: verificationCode,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!tempUser) {
      return res.status(400).json({ message: 'Mã xác minh không hợp lệ hoặc đã hết hạn' });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: 'Tên người dùng đã tồn tại' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user with verified email
    const user = new User({
      username,
      email,
      password: hashedPassword,
      emailVerified: true,
      badges: ['member'] // Default badge
    });

    await user.save();

    // Delete temporary user
    await tempUser.deleteOne();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Đăng ký thành công',
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        badges: user.badges
      }
    });
  } catch (err) {
    console.error('Verify and register error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Thông tin đăng nhập không chính xác' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Thông tin đăng nhập không chính xác' });
    
    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    res.json({ 
      token, 
      user: { 
        _id: user._id, 
        username: user.username, 
        email: user.email, 
        role: user.role,
        badges: user.badges,
        avatar: user.avatar,
        bio: user.bio,
        vtuber_description: user.vtuber_description,
        artist_description: user.artist_description,
        youtube: user.youtube,
        twitch: user.twitch,
        twitter: user.twitter,
        instagram: user.instagram
      } 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy danh sách user
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy user theo id
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cập nhật user profile
router.put('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const {
      avatar, bio, description, vtuber_description, artist_description,
      profile_email, facebook, website, youtube, twitch, twitter, instagram
    } = req.body;

    // Update fields
    if (avatar !== undefined) user.avatar = avatar;
    if (bio !== undefined) user.bio = bio;
    if (description !== undefined) user.description = description;
    if (vtuber_description !== undefined) user.vtuber_description = vtuber_description;
    if (artist_description !== undefined) user.artist_description = artist_description;
    if (profile_email !== undefined) user.profile_email = profile_email;
    if (facebook !== undefined) user.facebook = facebook;
    if (website !== undefined) user.website = website;
    if (youtube !== undefined) user.youtube = youtube;
    if (twitch !== undefined) user.twitch = twitch;
    if (twitter !== undefined) user.twitter = twitter;
    if (instagram !== undefined) user.instagram = instagram;

    await user.save();
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy commissions của user
router.get('/:id/commissions', async (req, res) => {
  try {
    const { Commission } = require('../models/Commission');
    const commissions = await Commission.find({ user: req.params.id });
    res.json({ commissions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Xóa user
router.delete('/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 