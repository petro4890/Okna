const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { User, Client, Order, Job, Notification } = require('../models');
const { 
  authenticateToken, 
  requireAdmin, 
  requireUserManagement,
  requireOwnershipOrAdmin,
  logUserAction 
} = require('../middleware/auth');

const router = express.Router();

// Get all users (Admin only)
router.get('/', authenticateToken, requireUserManagement, async (req, res) => {
  try {
    const { role, page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (role) {
      whereClause.role = role;
    }
    if (search) {
      whereClause[require('sequelize').Op.or] = [
        { first_name: { [require('sequelize').Op.iLike]: `%${search}%` } },
        { last_name: { [require('sequelize').Op.iLike]: `%${search}%` } },
        { email: { [require('sequelize').Op.iLike]: `%${search}%` } },
        { username: { [require('sequelize').Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['password_hash'] },
      include: [{
        model: Client,
        as: 'clientProfile',
        required: false
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      users: users.map(user => user.toSafeJSON()),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID
router.get('/:userId', authenticateToken, requireOwnershipOrAdmin('userId'), async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password_hash'] },
      include: [{
        model: Client,
        as: 'clientProfile',
        required: false,
        include: [{
          model: User,
          as: 'assignedManager',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        }]
      }]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: user.toSafeJSON() });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user (Admin only)
router.post('/', authenticateToken, requireUserManagement, logUserAction('create_user'), [
  body('email').optional().isEmail().normalizeEmail(),
  body('phone_number').optional().isMobilePhone(),
  body('username').optional().isLength({ min: 3, max: 100 }).isAlphanumeric(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('first_name').isLength({ min: 1, max: 100 }).trim(),
  body('last_name').isLength({ min: 1, max: 100 }).trim(),
  body('role').isIn(['director', 'manager', 'supervisor', 'measurer', 'delivery_person', 'installer', 'client'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      email,
      phone_number,
      username,
      password,
      first_name,
      last_name,
      role,
      // Client-specific fields
      client_type,
      company_name,
      tax_id,
      address,
      city,
      state,
      postal_code,
      country,
      assigned_manager_id
    } = req.body;

    // Ensure at least one login method is provided
    if (!email && !phone_number && !username) {
      return res.status(400).json({ 
        error: 'At least one login method (email, phone, or username) is required' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          email ? { email } : null,
          phone_number ? { phone_number } : null,
          username ? { username } : null
        ].filter(Boolean)
      }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists with this email, phone, or username' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      email,
      phone_number,
      username,
      password_hash,
      first_name,
      last_name,
      role
    });

    // Create client profile if role is client
    if (role === 'client') {
      if (!client_type || !address || !city) {
        await user.destroy();
        return res.status(400).json({ 
          error: 'Client type, address, and city are required for client users' 
        });
      }

      await Client.create({
        user_id: user.id,
        client_type,
        company_name,
        tax_id,
        address,
        city,
        state,
        postal_code,
        country: country || 'USA',
        assigned_manager_id
      });
    }

    res.status(201).json({
      message: 'User created successfully',
      user: user.toSafeJSON()
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/:userId', authenticateToken, requireOwnershipOrAdmin('userId'), logUserAction('update_user'), [
  body('email').optional().isEmail().normalizeEmail(),
  body('phone_number').optional().isMobilePhone(),
  body('username').optional().isLength({ min: 3, max: 100 }).isAlphanumeric(),
  body('first_name').optional().isLength({ min: 1, max: 100 }).trim(),
  body('last_name').optional().isLength({ min: 1, max: 100 }).trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updateData.password_hash;
    delete updateData.role; // Role changes should be handled separately
    delete updateData.is_active;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check for duplicate email/phone/username
    if (updateData.email || updateData.phone_number || updateData.username) {
      const existingUser = await User.findOne({
        where: {
          id: { [require('sequelize').Op.ne]: userId },
          [require('sequelize').Op.or]: [
            updateData.email ? { email: updateData.email } : null,
            updateData.phone_number ? { phone_number: updateData.phone_number } : null,
            updateData.username ? { username: updateData.username } : null
          ].filter(Boolean)
        }
      });

      if (existingUser) {
        return res.status(409).json({ error: 'Email, phone, or username already exists' });
      }
    }

    await user.update(updateData);

    res.json({
      message: 'User updated successfully',
      user: user.toSafeJSON()
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Change user password
router.put('/:userId/password', authenticateToken, requireOwnershipOrAdmin('userId'), [
  body('current_password').if((value, { req }) => req.user.id === req.params.userId).notEmpty(),
  body('new_password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { current_password, new_password } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user is changing their own password, verify current password
    if (req.user.id === userId) {
      const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    // Hash new password
    const password_hash = await bcrypt.hash(new_password, 12);
    await user.update({ password_hash });

    res.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Update user role (Admin only)
router.put('/:userId/role', authenticateToken, requireUserManagement, logUserAction('update_user_role'), [
  body('role').isIn(['director', 'manager', 'supervisor', 'measurer', 'delivery_person', 'installer', 'client'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { role } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({ role });

    res.json({
      message: 'User role updated successfully',
      user: user.toSafeJSON()
    });

  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Activate/Deactivate user (Admin only)
router.put('/:userId/status', authenticateToken, requireUserManagement, logUserAction('update_user_status'), [
  body('is_active').isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { is_active } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({ is_active });

    res.json({
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
      user: user.toSafeJSON()
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Get user's orders (for clients)
router.get('/:userId/orders', authenticateToken, requireOwnershipOrAdmin('userId'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    // Find client profile
    const client = await Client.findOne({ where: { user_id: userId } });
    if (!client) {
      return res.status(404).json({ error: 'Client profile not found' });
    }

    const whereClause = { client_id: client.id };
    if (status) {
      whereClause.status = status;
    }

    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'assignedManager',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      orders,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ error: 'Failed to fetch user orders' });
  }
});

// Get user's jobs (for workers)
router.get('/:userId/jobs', authenticateToken, requireOwnershipOrAdmin('userId'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status, job_type } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = { assigned_worker_id: userId };
    if (status) {
      whereClause.status = status;
    }
    if (job_type) {
      whereClause.job_type = job_type;
    }

    const { count, rows: jobs } = await Job.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Order,
          as: 'order',
          include: [
            {
              model: Client,
              as: 'client',
              include: [
                {
                  model: User,
                  as: 'user',
                  attributes: ['first_name', 'last_name', 'phone_number']
                }
              ]
            }
          ]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['scheduled_date', 'ASC'], ['scheduled_time', 'ASC']]
    });

    res.json({
      jobs,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get user jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch user jobs' });
  }
});

// Get user's notifications
router.get('/:userId/notifications', authenticateToken, requireOwnershipOrAdmin('userId'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, is_read } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = { user_id: userId };
    if (is_read !== undefined) {
      whereClause.is_read = is_read === 'true';
    }

    const { count, rows: notifications } = await Notification.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      notifications: notifications.map(n => n.toJSON()),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get user notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch user notifications' });
  }
});

// Delete user (Admin only)
router.delete('/:userId', authenticateToken, requireUserManagement, logUserAction('delete_user'), async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.id === userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.destroy();

    res.json({ message: 'User deleted successfully' });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;