const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Job = sequelize.define('Job', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    order_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'orders',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    assigned_worker_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    job_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['measuring', 'delivery', 'installation']]
      }
    },
    status: {
      type: DataTypes.ENUM(
        'assigned',
        'en_route',
        'arrived',
        'in_progress',
        'completed',
        'cancelled'
      ),
      defaultValue: 'assigned'
    },
    scheduled_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    scheduled_time: {
      type: DataTypes.TIME,
      allowNull: true
    },
    location_address: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    location_coordinates: {
      type: DataTypes.GEOMETRY('POINT'),
      allowNull: true
    },
    estimated_duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Duration in minutes'
    },
    actual_start_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    actual_end_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'jobs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      beforeValidate: (job) => {
        if (job.location_address) job.location_address = job.location_address.trim();
        if (job.notes) job.notes = job.notes.trim();
        if (job.job_type) job.job_type = job.job_type.toLowerCase();
      }
    }
  });

  // Instance methods
  Job.prototype.getJobTypeDisplay = function() {
    const typeMap = {
      'measuring': 'Measuring',
      'delivery': 'Delivery',
      'installation': 'Installation'
    };
    return typeMap[this.job_type] || this.job_type;
  };

  Job.prototype.getStatusDisplay = function() {
    const statusMap = {
      'assigned': 'Assigned',
      'en_route': 'En Route',
      'arrived': 'Arrived',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return statusMap[this.status] || this.status;
  };

  Job.prototype.isActive = function() {
    return !['completed', 'cancelled'].includes(this.status);
  };

  Job.prototype.canStart = function() {
    return ['assigned', 'en_route', 'arrived'].includes(this.status);
  };

  Job.prototype.canComplete = function() {
    return ['in_progress'].includes(this.status);
  };

  Job.prototype.getScheduledDateTime = function() {
    if (this.scheduled_date && this.scheduled_time) {
      return new Date(`${this.scheduled_date}T${this.scheduled_time}`);
    }
    return null;
  };

  Job.prototype.getActualDuration = function() {
    if (this.actual_start_time && this.actual_end_time) {
      return Math.round((this.actual_end_time - this.actual_start_time) / (1000 * 60)); // minutes
    }
    return null;
  };

  Job.prototype.isOverdue = function() {
    const scheduledDateTime = this.getScheduledDateTime();
    if (!scheduledDateTime) return false;
    
    return new Date() > scheduledDateTime && this.isActive();
  };

  Job.prototype.getNextValidStatuses = function() {
    const statusFlow = {
      'assigned': ['en_route', 'cancelled'],
      'en_route': ['arrived', 'cancelled'],
      'arrived': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': []
    };
    return statusFlow[this.status] || [];
  };

  Job.prototype.canUpdateStatus = function(newStatus) {
    return this.getNextValidStatuses().includes(newStatus);
  };

  return Job;
};