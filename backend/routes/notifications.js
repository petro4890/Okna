const express = require('express');
const { body, validationResult } = require('express-validator');
const { Notification, User, Job, Order } = require('../models');
const { 
  authenticateToken, 
  requireAdmin, 
  requireOwnershipOrAdmin 
} = require('../middleware/auth');
const { sendPushNotification } = require('../utils/notifications');

const router = express.Router();

// Get user notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      is_read, 
      type,
      start_date,
      end_date
    } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = { user_id: req.user.id };
    
    if (is_read !== undefined) {
      whereClause.is_read = is_read === 'true';
    }
    
    if (type) {
      whereClause.type = type;
    }
    
    if (start_date || end_date) {
      whereClause.created_at = {};
      if (start_date) whereClause.created_at[require('sequelize').Op.gte] = new Date(start_date);
      if (end_date) whereClause.created_at[require('sequelize').Op.lte] = new Date(end_date);
    }

    const { count, rows: notifications } = await Notification.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Job,
          as: 'relatedJob',
          required: false,
          include: [{
            model: Order,
            as: 'order',
            attributes: ['id', 'order_number']
          }]
        },
        {
          model: Order,
          as: 'relatedOrder',
          required: false,
          attributes: ['id', 'order_number']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    // Get unread count
    const unreadCount = await Notification.count({
      where: {
        user_id: req.user.id,
        is_read: false
      }
    });

    res.json({
      notifications: notifications.map(n => n.toJSON()),
      unread_count: unreadCount,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get notification by ID
router.get('/:notificationId', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        user_id: req.user.id
      },
      include: [
        {
          model: Job,
          as: 'relatedJob',
          required: false,
          include: [{
            model: Order,
            as: 'order',
            attributes: ['id', 'order_number']
          }]
        },
        {
          model: Order,
          as: 'relatedOrder',
          required: false,
          attributes: ['id', 'order_number']
        }
      ]
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ notification: notification.toJSON() });

  } catch (error) {
    console.error('Get notification error:', error);
    res.status(500).json({ error: 'Failed to fetch notification' });
  }
});

// Mark notification as read
router.put('/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        user_id: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (!notification.is_read) {
      await notification.markAsRead();
    }

    res.json({ 
      message: 'Notification marked as read',
      notification: notification.toJSON()
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const [updatedCount] = await Notification.update(
      { is_read: true },
      {
        where: {
          user_id: req.user.id,
          is_read: false
        }
      }
    );

    res.json({ 
      message: 'All notifications marked as read',
      updated_count: updatedCount
    });

  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Create notification (Admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('user_id').isUUID().withMessage('Valid user ID is required'),
  body('title').isLength({ min: 1, max: 255 }).trim(),
  body('message').isLength({ min: 1, max: 1000 }).trim(),
  body('type').isIn(['job_assignment', 'status_update', 'general', 'system', 'reminder']),
  body('related_job_id').optional().isUUID(),
  body('related_order_id').optional().isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      user_id,
      title,
      message,
      type,
      related_job_id,
      related_order_id
    } = req.body;

    // Verify user exists
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify related job exists if provided
    if (related_job_id) {
      const job = await Job.findByPk(related_job_id);
      if (!job) {
        return res.status(404).json({ error: 'Related job not found' });
      }
    }

    // Verify related order exists if provided
    if (related_order_id) {
      const order = await Order.findByPk(related_order_id);
      if (!order) {
        return res.status(404).json({ error: 'Related order not found' });
      }
    }

    // Create notification
    const notification = await Notification.create({
      user_id,
      title,
      message,
      type,
      related_job_id,
      related_order_id
    });

    // Send push notification if applicable
    if (notification.shouldSendPush()) {
      await sendPushNotification(user_id, title, message, {
        notification_id: notification.id,
        type,
        related_job_id,
        related_order_id
      });
    }

    res.status(201).json({
      message: 'Notification created successfully',
      notification: notification.toJSON()
    });

  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Send broadcast notification (Admin only)
router.post('/broadcast', authenticateToken, requireAdmin, [
  body('title').isLength({ min: 1, max: 255 }).trim(),
  body('message').isLength({ min: 1, max: 1000 }).trim(),
  body('type').isIn(['general', 'system']),
  body('target_roles').optional().isArray(),
  body('target_users').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      message,
      type,
      target_roles,
      target_users
    } = req.body;

    let targetUserIds = [];

    // Get users by roles if specified
    if (target_roles && target_roles.length > 0) {
      const usersByRole = await User.findAll({
        where: {
          role: { [require('sequelize').Op.in]: target_roles },
          is_active: true
        },
        attributes: ['id']
      });
      targetUserIds = targetUserIds.concat(usersByRole.map(u => u.id));
    }

    // Add specific users if specified
    if (target_users && target_users.length > 0) {
      targetUserIds = targetUserIds.concat(target_users);
    }

    // If no targets specified, send to all active users
    if (targetUserIds.length === 0) {
      const allUsers = await User.findAll({
        where: { is_active: true },
        attributes: ['id']
      });
      targetUserIds = allUsers.map(u => u.id);
    }

    // Remove duplicates
    targetUserIds = [...new Set(targetUserIds)];

    // Create notifications for all target users
    const notifications = await Promise.all(
      targetUserIds.map(userId => 
        Notification.create({
          user_id: userId,
          title,
          message,
          type
        })
      )
    );

    // Send push notifications
    const pushPromises = targetUserIds.map(userId => 
      sendPushNotification(userId, title, message, {
        type: 'broadcast',
        notification_type: type
      })
    );

    await Promise.all(pushPromises);

    res.json({
      message: 'Broadcast notification sent successfully',
      recipients_count: targetUserIds.length,
      notifications_created: notifications.length
    });

  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({ error: 'Failed to send broadcast notification' });
  }
});

// Get notification statistics (Admin only)
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date, user_id } = req.query;
    
    const whereClause = {};
    if (user_id) whereClause.user_id = user_id;
    if (start_date || end_date) {
      whereClause.created_at = {};
      if (start_date) whereClause.created_at[require('sequelize').Op.gte] = new Date(start_date);
      if (end_date) whereClause.created_at[require('sequelize').Op.lte] = new Date(end_date);
    }

    const [
      totalNotifications,
      unreadNotifications,
      readNotifications,
      typeBreakdown,
      recentActivity
    ] = await Promise.all([
      Notification.count({ where: whereClause }),
      Notification.count({ 
        where: { ...whereClause, is_read: false }
      }),
      Notification.count({ 
        where: { ...whereClause, is_read: true }
      }),
      Notification.findAll({
        where: whereClause,
        attributes: [
          'type',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['type'],
        raw: true
      }),
      Notification.findAll({
        where: whereClause,
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'role']
        }],
        limit: 10,
        order: [['created_at', 'DESC']]
      })
    ]);

    res.json({
      overview: {
        total_notifications: totalNotifications,
        unread_notifications: unreadNotifications,
        read_notifications: readNotifications,
        read_rate: totalNotifications > 0 ? ((readNotifications / totalNotifications) * 100).toFixed(2) : 0
      },
      type_breakdown: typeBreakdown,
      recent_activity: recentActivity.map(n => n.toJSON())
    });

  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({ error: 'Failed to fetch notification statistics' });
  }
});

// Delete notification
router.delete('/:notificationId', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        user_id: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await notification.destroy();

    res.json({ message: 'Notification deleted successfully' });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Delete all read notifications
router.delete('/read/all', authenticateToken, async (req, res) => {
  try {
    const deletedCount = await Notification.destroy({
      where: {
        user_id: req.user.id,
        is_read: true
      }
    });

    res.json({ 
      message: 'All read notifications deleted successfully',
      deleted_count: deletedCount
    });

  } catch (error) {
    console.error('Delete read notifications error:', error);
    res.status(500).json({ error: 'Failed to delete read notifications' });
  }
});

// Get notification preferences (placeholder for future implementation)
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    // This would typically fetch user notification preferences from a separate table
    // For now, return default preferences
    const preferences = {
      email_notifications: true,
      sms_notifications: true,
      push_notifications: true,
      notification_types: {
        job_assignment: true,
        status_update: true,
        general: true,
        system: true,
        reminder: true
      },
      quiet_hours: {
        enabled: false,
        start_time: '22:00',
        end_time: '08:00'
      }
    };

    res.json({ preferences });

  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

// Update notification preferences (placeholder for future implementation)
router.put('/preferences', authenticateToken, [
  body('email_notifications').optional().isBoolean(),
  body('sms_notifications').optional().isBoolean(),
  body('push_notifications').optional().isBoolean(),
  body('notification_types').optional().isObject(),
  body('quiet_hours').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // This would typically update user notification preferences in a separate table
    // For now, just return success
    const preferences = req.body;

    res.json({
      message: 'Notification preferences updated successfully',
      preferences
    });

  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

module.exports = router;