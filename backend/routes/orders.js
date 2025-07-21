const express = require('express');
const { body, validationResult } = require('express-validator');
const { Order, OrderItem, Client, User, Job, Contract, Notification } = require('../models');
const { 
  authenticateToken, 
  requireManagement, 
  requireAdmin,
  logUserAction 
} = require('../middleware/auth');
const { sendOrderStatusNotification } = require('../utils/notifications');

const router = express.Router();

// Get all orders (Management only)
router.get('/', authenticateToken, requireManagement, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      client_id, 
      assigned_manager_id,
      search,
      start_date,
      end_date
    } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (client_id) whereClause.client_id = client_id;
    if (assigned_manager_id) whereClause.assigned_manager_id = assigned_manager_id;
    
    if (start_date || end_date) {
      whereClause.order_date = {};
      if (start_date) whereClause.order_date[require('sequelize').Op.gte] = new Date(start_date);
      if (end_date) whereClause.order_date[require('sequelize').Op.lte] = new Date(end_date);
    }

    const include = [
      {
        model: Client,
        as: 'client',
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        }]
      },
      {
        model: User,
        as: 'assignedManager',
        attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
      },
      {
        model: OrderItem,
        as: 'items'
      }
    ];

    // Add search functionality
    if (search) {
      whereClause[require('sequelize').Op.or] = [
        { order_number: { [require('sequelize').Op.iLike]: `%${search}%` } },
        { '$client.user.first_name$': { [require('sequelize').Op.iLike]: `%${search}%` } },
        { '$client.user.last_name$': { [require('sequelize').Op.iLike]: `%${search}%` } },
        { '$client.company_name$': { [require('sequelize').Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereClause,
      include,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      distinct: true
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
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get order by ID
router.get('/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: Client,
          as: 'client',
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
          }, {
            model: User,
            as: 'assignedManager',
            attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
          }]
        },
        {
          model: User,
          as: 'assignedManager',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        },
        {
          model: OrderItem,
          as: 'items'
        },
        {
          model: Job,
          as: 'jobs',
          include: [{
            model: User,
            as: 'assignedWorker',
            attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number', 'role']
          }]
        },
        {
          model: Contract,
          as: 'contracts'
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check permissions
    const isClient = req.user.role === 'client';
    const isClientOwner = isClient && order.client.user_id === req.user.id;
    const canViewAllOrders = req.user.canViewAllProjects();

    if (!canViewAllOrders && !isClientOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ order });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Create new order (Admin only)
router.post('/', authenticateToken, requireAdmin, logUserAction('create_order'), [
  body('client_id').isUUID().withMessage('Valid client ID is required'),
  body('assigned_manager_id').optional().isUUID(),
  body('total_amount').optional().isDecimal({ decimal_digits: '0,2' }),
  body('estimated_completion_date').optional().isISO8601(),
  body('items').isArray({ min: 1 }).withMessage('At least one order item is required'),
  body('items.*.product_name').notEmpty().withMessage('Product name is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unit_price').optional().isDecimal({ decimal_digits: '0,2' })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      client_id,
      assigned_manager_id,
      total_amount,
      estimated_completion_date,
      notes,
      items
    } = req.body;

    // Verify client exists
    const client = await Client.findByPk(client_id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Verify manager exists if provided
    if (assigned_manager_id) {
      const manager = await User.findOne({
        where: {
          id: assigned_manager_id,
          role: { [require('sequelize').Op.in]: ['director', 'manager'] }
        }
      });
      if (!manager) {
        return res.status(404).json({ error: 'Manager not found' });
      }
    }

    // Create order
    const order = await Order.create({
      client_id,
      assigned_manager_id,
      total_amount,
      estimated_completion_date,
      notes
    });

    // Create order items
    const orderItems = await Promise.all(
      items.map(item => OrderItem.create({
        order_id: order.id,
        product_name: item.product_name,
        product_type: item.product_type,
        quantity: item.quantity,
        unit_price: item.unit_price,
        specifications: item.specifications
      }))
    );

    // Send notification to client
    const clientUser = await User.findByPk(client.user_id);
    if (clientUser) {
      await Notification.create({
        user_id: clientUser.id,
        title: 'New Order Created',
        message: `Your order ${order.order_number} has been created and is being processed.`,
        type: 'general',
        related_order_id: order.id
      });
    }

    // Fetch complete order data
    const completeOrder = await Order.findByPk(order.id, {
      include: [
        {
          model: Client,
          as: 'client',
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
          }]
        },
        {
          model: User,
          as: 'assignedManager',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        },
        {
          model: OrderItem,
          as: 'items'
        }
      ]
    });

    res.status(201).json({
      message: 'Order created successfully',
      order: completeOrder
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Update order
router.put('/:orderId', authenticateToken, requireAdmin, logUserAction('update_order'), [
  body('assigned_manager_id').optional().isUUID(),
  body('total_amount').optional().isDecimal({ decimal_digits: '0,2' }),
  body('estimated_completion_date').optional().isISO8601(),
  body('actual_completion_date').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params;
    const updateData = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify manager exists if provided
    if (updateData.assigned_manager_id) {
      const manager = await User.findOne({
        where: {
          id: updateData.assigned_manager_id,
          role: { [require('sequelize').Op.in]: ['director', 'manager'] }
        }
      });
      if (!manager) {
        return res.status(404).json({ error: 'Manager not found' });
      }
    }

    await order.update(updateData);

    res.json({
      message: 'Order updated successfully',
      order
    });

  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Update order status
router.put('/:orderId/status', authenticateToken, requireManagement, logUserAction('update_order_status'), [
  body('status').isIn([
    'pending', 'measuring_scheduled', 'measuring_in_progress', 'measuring_completed',
    'production_scheduled', 'in_production', 'production_completed',
    'delivery_scheduled', 'in_delivery', 'delivered',
    'installation_scheduled', 'installation_in_progress', 'installation_completed',
    'completed', 'cancelled'
  ])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params;
    const { status, notes } = req.body;

    const order = await Order.findByPk(orderId, {
      include: [{
        model: Client,
        as: 'client',
        include: [{
          model: User,
          as: 'user'
        }]
      }]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const oldStatus = order.status;
    await order.update({ 
      status,
      notes: notes || order.notes,
      actual_completion_date: status === 'completed' ? new Date() : order.actual_completion_date
    });

    // Send notification to client
    const clientUser = order.client.user;
    if (clientUser) {
      await Notification.create({
        user_id: clientUser.id,
        title: 'Order Status Update',
        message: `Your order ${order.order_number} status has been updated to ${order.getStatusDisplay()}`,
        type: 'status_update',
        related_order_id: order.id
      });

      // Send email/SMS notification
      await sendOrderStatusNotification(clientUser, order, oldStatus, status);
    }

    res.json({
      message: 'Order status updated successfully',
      order: {
        ...order.toJSON(),
        old_status: oldStatus,
        new_status: status
      }
    });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Add order item
router.post('/:orderId/items', authenticateToken, requireAdmin, [
  body('product_name').notEmpty().withMessage('Product name is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('unit_price').optional().isDecimal({ decimal_digits: '0,2' })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params;
    const { product_name, product_type, quantity, unit_price, specifications } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderItem = await OrderItem.create({
      order_id: orderId,
      product_name,
      product_type,
      quantity,
      unit_price,
      specifications
    });

    res.status(201).json({
      message: 'Order item added successfully',
      item: orderItem
    });

  } catch (error) {
    console.error('Add order item error:', error);
    res.status(500).json({ error: 'Failed to add order item' });
  }
});

// Update order item
router.put('/:orderId/items/:itemId', authenticateToken, requireAdmin, [
  body('product_name').optional().notEmpty(),
  body('quantity').optional().isInt({ min: 1 }),
  body('unit_price').optional().isDecimal({ decimal_digits: '0,2' })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId, itemId } = req.params;
    const updateData = req.body;

    const orderItem = await OrderItem.findOne({
      where: { id: itemId, order_id: orderId }
    });

    if (!orderItem) {
      return res.status(404).json({ error: 'Order item not found' });
    }

    await orderItem.update(updateData);

    res.json({
      message: 'Order item updated successfully',
      item: orderItem
    });

  } catch (error) {
    console.error('Update order item error:', error);
    res.status(500).json({ error: 'Failed to update order item' });
  }
});

// Delete order item
router.delete('/:orderId/items/:itemId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { orderId, itemId } = req.params;

    const orderItem = await OrderItem.findOne({
      where: { id: itemId, order_id: orderId }
    });

    if (!orderItem) {
      return res.status(404).json({ error: 'Order item not found' });
    }

    await orderItem.destroy();

    res.json({ message: 'Order item deleted successfully' });

  } catch (error) {
    console.error('Delete order item error:', error);
    res.status(500).json({ error: 'Failed to delete order item' });
  }
});

// Get order statistics (Management only)
router.get('/stats/overview', authenticateToken, requireManagement, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const whereClause = {};
    if (start_date || end_date) {
      whereClause.created_at = {};
      if (start_date) whereClause.created_at[require('sequelize').Op.gte] = new Date(start_date);
      if (end_date) whereClause.created_at[require('sequelize').Op.lte] = new Date(end_date);
    }

    const [
      totalOrders,
      activeOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue,
      statusBreakdown
    ] = await Promise.all([
      Order.count({ where: whereClause }),
      Order.count({ 
        where: { 
          ...whereClause,
          status: { [require('sequelize').Op.notIn]: ['completed', 'cancelled'] }
        }
      }),
      Order.count({ 
        where: { ...whereClause, status: 'completed' }
      }),
      Order.count({ 
        where: { ...whereClause, status: 'cancelled' }
      }),
      Order.sum('total_amount', { 
        where: { ...whereClause, status: 'completed' }
      }),
      Order.findAll({
        where: whereClause,
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      })
    ]);

    res.json({
      overview: {
        total_orders: totalOrders,
        active_orders: activeOrders,
        completed_orders: completedOrders,
        cancelled_orders: cancelledOrders,
        total_revenue: totalRevenue || 0,
        completion_rate: totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(2) : 0
      },
      status_breakdown: statusBreakdown
    });

  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ error: 'Failed to fetch order statistics' });
  }
});

// Delete order (Admin only)
router.delete('/:orderId', authenticateToken, requireAdmin, logUserAction('delete_order'), async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if order can be deleted (only pending orders)
    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending orders can be deleted' });
    }

    await order.destroy();

    res.json({ message: 'Order deleted successfully' });

  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

module.exports = router;