const express = require('express');
const Project = require('../models/Project');
const User = require('../models/User');
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

// Middleware kiểm tra admin (email: huynguyen86297@gmail.com)
function adminAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  
  // Find user by ID to check email
  User.findById(req.user.userId)
    .then(user => {
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (user.email !== 'huynguyen86297@gmail.com') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
      }
      req.adminUser = user;
      next();
    })
    .catch(err => res.status(500).json({ message: err.message }));
}

// Lấy tất cả projects
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('vtubers', 'username avatar bio vtuber_description youtube twitch twitter instagram')
      .sort({ created_date: -1 });
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy project theo id
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('vtubers', 'username avatar bio vtuber_description youtube twitch twitter instagram');
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Tạo project mới (chỉ admin)
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const { name, created_date, project_description } = req.body;
    
    if (!name || !created_date) {
      return res.status(400).json({ message: 'Name and created_date are required' });
    }

    const project = new Project({
      name,
      created_date: new Date(created_date),
      project_description: project_description || '',
      logo_url: '', // Will be set manually in DB
      avatar_url: '', // Will be set manually in DB
      vtubers: [] // Will be set manually in DB
    });

    await project.save();
    res.status(201).json({ project });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cập nhật project (chỉ admin)
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const { name, created_date, project_description } = req.body;
    
    if (name) project.name = name;
    if (created_date) project.created_date = new Date(created_date);
    if (project_description !== undefined) project.project_description = project_description;

    await project.save();
    res.json({ project });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Xóa project (chỉ admin)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    await project.deleteOne();
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 