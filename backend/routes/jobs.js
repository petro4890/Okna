const express = require('express');
const { body, validationResult } = require('express-validator');
const { Job, JobStatusUpdate, Order, Client, User, Notification } = require('../models');
const { 
  authenticateToken, 
  requireManagement, 
  requireWorker,
  requireOwnershipOrAdmin,
  logUserAction 
} = require('../middleware/auth');
const { sendJobAssignmentNotification } = require('../utils/notifications');

const router = express.Router();

// Get all jobs (Management view)
router.get('/', authenticateToken, requireManagement, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      job_type,
      assigned_worker_id,
      scheduled_date,
      search
    } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (job_type) whereClause.job_type = job_type;
    if (assigned_worker_id) whereClause.assigned_worker_id = assigned_worker_id;
    if (scheduled_date) whereClause.scheduled_date = scheduled_date;

    const include = [
      {
        model: Order,
        as: 'order',
        include: [{
          model: Client,
          as: 'client',
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'first_name', 'last_name', 'phone_number']
          }]
        }]
      },
      {
        model: User,
        as: 'assignedWorker',
        attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number', 'role']
      }
    ];

    // Add search functionality
    if (search) {
      whereClause[require('sequelize').Op.or] = [
        { location_address: { [require('sequelize').Op.iLike]: `%${search}%` } },
        { '$order.order_number$': { [require('sequelize').Op.iLike]: `%${search}%` } },
        { '$assignedWorker.first_name$': { [require('sequelize').Op.iLike]: `%${search}%` } },
        { '$assignedWorker.last_name$': { [require('sequelize').Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: jobs } = await Job.findAndCountAll({
      where: whereClause,
      include,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['scheduled_date', 'ASC'], ['scheduled_time', 'ASC']],
      distinct: true
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
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Get job by ID
router.get('/:jobId', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findByPk(jobId, {
      include: [
        {
          model: Order,
          as: 'order',
          include: [{
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
          }]
        },
        {
          model: User,
          as: 'assignedWorker',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number', 'role']
        },
        {
          model: JobStatusUpdate,
          as: 'statusUpdates',
          include: [{
            model: User,
            as: 'updatedBy',
            attributes: ['id', 'first_name', 'last_name']
          }],
          order: [['created_at', 'DESC']]
        }
      ]
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check permissions
    const isWorker = req.user.isWorker() && job.assigned_worker_id === req.user.id;
    const canViewAllJobs = req.user.canViewAllProjects();
    const isClient = req.user.role === 'client' && job.order.client.user_id === req.user.id;

    if (!canViewAllJobs && !isWorker && !isClient) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ job });

  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Create new job (Management only)
router.post('/', authenticateToken, requireManagement, logUserAction('create_job'), [
  body('order_id').isUUID().withMessage('Valid order ID is required'),
  body('job_type').isIn(['measuring', 'delivery', 'installation']).withMessage('Valid job type is required'),
  body('location_address').notEmpty().withMessage('Location address is required'),
  body('scheduled_date').optional().isISO8601(),
  body('scheduled_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('assigned_worker_id').optional().isUUID(),
  body('estimated_duration').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      order_id,
      job_type,
      location_address,
      scheduled_date,
      scheduled_time,
      assigned_worker_id,
      estimated_duration,
      notes,
      location_coordinates
    } = req.body;

    // Verify order exists
    const order = await Order.findByPk(order_id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify worker exists and has correct role if provided
    if (assigned_worker_id) {
      const workerRoleMap = {
        'measuring': 'measurer',
        'delivery': 'delivery_person',
        'installation': 'installer'
      };

      const worker = await User.findOne({
        where: {
          id: assigned_worker_id,
          role: workerRoleMap[job_type]
        }
      });

      if (!worker) {
        return res.status(404).json({ error: `Worker not found or incorrect role for ${job_type} job` });
      }
    }

    // Create job
    const job = await Job.create({
      order_id,
      job_type,
      location_address,
      scheduled_date,
      scheduled_time,
      assigned_worker_id,
      estimated_duration,
      notes,
      location_coordinates
    });

    // Create initial status update
    await JobStatusUpdate.create({
      job_id: job.id,
      new_status: 'assigned',
      updated_by: req.user.id,
      notes: 'Job created and assigned'
    });

    // Send notification to worker if assigned
    if (assigned_worker_id) {
      const worker = await User.findByPk(assigned_worker_id);
      if (worker) {
        await Notification.createJobAssignment(
          worker.id,
          job.id,
          job.getJobTypeDisplay(),
          job.location_address
        );

        // Send email/SMS notification
        await sendJobAssignmentNotification(worker, job, order);
      }
    }

    // Fetch complete job data
    const completeJob = await Job.findByPk(job.id, {
      include: [
        {
          model: Order,
          as: 'order',
          include: [{
            model: Client,
            as: 'client',
            include: [{
              model: User,
              as: 'user',
              attributes: ['id', 'first_name', 'last_name', 'phone_number']
            }]
          }]
        },
        {
          model: User,
          as: 'assignedWorker',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number', 'role']
        }
      ]
    });

    res.status(201).json({
      message: 'Job created successfully',
      job: completeJob
    });

  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Update job
router.put('/:jobId', authenticateToken, requireManagement, logUserAction('update_job'), [
  body('scheduled_date').optional().isISO8601(),
  body('scheduled_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('assigned_worker_id').optional().isUUID(),
  body('estimated_duration').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { jobId } = req.params;
    const updateData = req.body;

    const job = await Job.findByPk(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify worker exists and has correct role if provided
    if (updateData.assigned_worker_id) {
      const workerRoleMap = {
        'measuring': 'measurer',
        'delivery': 'delivery_person',
        'installation': 'installer'
      };

      const worker = await User.findOne({
        where: {
          id: updateData.assigned_worker_id,
          role: workerRoleMap[job.job_type]
        }
      });

      if (!worker) {
        return res.status(404).json({ error: `Worker not found or incorrect role for ${job.job_type} job` });
      }

      // Send notification if worker changed
      if (job.assigned_worker_id !== updateData.assigned_worker_id) {
        const order = await Order.findByPk(job.order_id);
        await Notification.createJobAssignment(
          worker.id,
          job.id,
          job.getJobTypeDisplay(),
          job.location_address
        );

        await sendJobAssignmentNotification(worker, job, order);
      }
    }

    await job.update(updateData);

    res.json({
      message: 'Job updated successfully',
      job
    });

  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// Update job status (Workers can update their own jobs)
router.put('/:jobId/status', authenticateToken, [
  body('status').isIn(['assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled']),
  body('notes').optional().isLength({ max: 500 }),
  body('location_coordinates').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { jobId } = req.params;
    const { status, notes, location_coordinates } = req.body;

    const job = await Job.findByPk(jobId, {
      include: [{
        model: Order,
        as: 'order',
        include: [{
          model: Client,
          as: 'client',
          include: [{
            model: User,
            as: 'user'
          }]
        }]
      }]
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check permissions
    const isAssignedWorker = job.assigned_worker_id === req.user.id;
    const canManageJobs = req.user.canViewAllProjects();

    if (!canManageJobs && !isAssignedWorker) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate status transition
    if (!job.canUpdateStatus(status)) {
      return res.status(400).json({ 
        error: 'Invalid status transition',
        current_status: job.status,
        valid_next_statuses: job.getNextValidStatuses()
      });
    }

    const oldStatus = job.status;

    // Update job status
    await job.update({ 
      status,
      actual_start_time: status === 'in_progress' && !job.actual_start_time ? new Date() : job.actual_start_time,
      actual_end_time: status === 'completed' ? new Date() : job.actual_end_time
    });

    // Create status update record
    await JobStatusUpdate.create({
      job_id: job.id,
      previous_status: oldStatus,
      new_status: status,
      updated_by: req.user.id,
      notes,
      location_coordinates
    });

    // Send notification to client and manager
    const clientUser = job.order.client.user;
    if (clientUser) {
      await Notification.create({
        user_id: clientUser.id,
        title: 'Job Status Update',
        message: `Your ${job.getJobTypeDisplay()} job status has been updated to ${job.getStatusDisplay()}`,
        type: 'status_update',
        related_job_id: job.id,
        related_order_id: job.order_id
      });
    }

    // Update order status based on job completion
    if (status === 'completed') {
      const orderStatusMap = {
        'measuring': 'measuring_completed',
        'delivery': 'delivered',
        'installation': 'installation_completed'
      };

      const newOrderStatus = orderStatusMap[job.job_type];
      if (newOrderStatus) {
        await job.order.update({ status: newOrderStatus });
      }
    }

    res.json({
      message: 'Job status updated successfully',
      job: {
        ...job.toJSON(),
        old_status: oldStatus,
        new_status: status
      }
    });

  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({ error: 'Failed to update job status' });
  }
});

// Get worker's jobs
router.get('/worker/:workerId', authenticateToken, requireOwnershipOrAdmin('workerId'), async (req, res) => {
  try {
    const { workerId } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      status, 
      job_type,
      date_from,
      date_to
    } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = { assigned_worker_id: workerId };
    if (status) whereClause.status = status;
    if (job_type) whereClause.job_type = job_type;
    
    if (date_from || date_to) {
      whereClause.scheduled_date = {};
      if (date_from) whereClause.scheduled_date[require('sequelize').Op.gte] = date_from;
      if (date_to) whereClause.scheduled_date[require('sequelize').Op.lte] = date_to;
    }

    const { count, rows: jobs } = await Job.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Order,
          as: 'order',
          include: [{
            model: Client,
            as: 'client',
            include: [{
              model: User,
              as: 'user',
              attributes: ['id', 'first_name', 'last_name', 'phone_number']
            }]
          }]
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
    console.error('Get worker jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch worker jobs' });
  }
});

// Get job statistics
router.get('/stats/overview', authenticateToken, requireManagement, async (req, res) => {
  try {
    const { start_date, end_date, job_type } = req.query;
    
    const whereClause = {};
    if (job_type) whereClause.job_type = job_type;
    if (start_date || end_date) {
      whereClause.scheduled_date = {};
      if (start_date) whereClause.scheduled_date[require('sequelize').Op.gte] = new Date(start_date);
      if (end_date) whereClause.scheduled_date[require('sequelize').Op.lte] = new Date(end_date);
    }

    const [
      totalJobs,
      activeJobs,
      completedJobs,
      overdueJobs,
      statusBreakdown,
      typeBreakdown
    ] = await Promise.all([
      Job.count({ where: whereClause }),
      Job.count({ 
        where: { 
          ...whereClause,
          status: { [require('sequelize').Op.in]: ['assigned', 'en_route', 'arrived', 'in_progress'] }
        }
      }),
      Job.count({ 
        where: { ...whereClause, status: 'completed' }
      }),
      Job.count({
        where: {
          ...whereClause,
          status: { [require('sequelize').Op.in]: ['assigned', 'en_route', 'arrived', 'in_progress'] },
          scheduled_date: { [require('sequelize').Op.lt]: new Date() }
        }
      }),
      Job.findAll({
        where: whereClause,
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      }),
      Job.findAll({
        where: whereClause,
        attributes: [
          'job_type',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['job_type'],
        raw: true
      })
    ]);

    res.json({
      overview: {
        total_jobs: totalJobs,
        active_jobs: activeJobs,
        completed_jobs: completedJobs,
        overdue_jobs: overdueJobs,
        completion_rate: totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(2) : 0
      },
      status_breakdown: statusBreakdown,
      type_breakdown: typeBreakdown
    });

  } catch (error) {
    console.error('Get job stats error:', error);
    res.status(500).json({ error: 'Failed to fetch job statistics' });
  }
});

// Delete job (Management only)
router.delete('/:jobId', authenticateToken, requireManagement, logUserAction('delete_job'), async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findByPk(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if job can be deleted (only assigned jobs)
    if (job.status !== 'assigned') {
      return res.status(400).json({ error: 'Only assigned jobs can be deleted' });
    }

    await job.destroy();

    res.json({ message: 'Job deleted successfully' });

  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

module.exports = router;