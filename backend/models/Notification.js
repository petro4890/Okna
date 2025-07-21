const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [1, 255]
      }
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [1, 1000]
      }
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['job_assignment', 'status_update', 'general', 'system', 'reminder']]
      }
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    related_job_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'jobs',
        key: 'id'
      }
    },
    related_order_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'orders',
        key: 'id'
      }
    }
  }, {
    tableName: 'notifications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    hooks: {
      beforeValidate: (notification) => {
        if (notification.title) notification.title = notification.title.trim();
        if (notification.message) notification.message = notification.message.trim();
        if (notification.type) notification.type = notification.type.toLowerCase();
      }
    }
  });

  // Instance methods
  Notification.prototype.getTypeDisplay = function() {
    const typeMap = {
      'job_assignment': 'Job Assignment',
      'status_update': 'Status Update',
      'general': 'General',
      'system': 'System',
      'reminder': 'Reminder'
    };
    return typeMap[this.type] || this.type;
  };

  Notification.prototype.markAsRead = function() {
    this.is_read = true;
    return this.save();
  };

  Notification.prototype.getIcon = function() {
    const iconMap = {
      'job_assignment': '📋',
      'status_update': '🔄',
      'general': '📢',
      'system': '⚙️',
      'reminder': '⏰'
    };
    return iconMap[this.type] || '📬';
  };

  Notification.prototype.getPriority = function() {
    const priorityMap = {
      'job_assignment': 'high',
      'status_update': 'medium',
      'general': 'low',
      'system': 'high',
      'reminder': 'medium'
    };
    return priorityMap[this.type] || 'low';
  };

  Notification.prototype.getTimeAgo = function() {
    const now = new Date();
    const created = new Date(this.created_at);
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return created.toLocaleDateString();
  };

  Notification.prototype.shouldSendPush = function() {
    // Define which notification types should trigger push notifications
    const pushTypes = ['job_assignment', 'status_update', 'system'];
    return pushTypes.includes(this.type);
  };

  Notification.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return {
      ...values,
      typeDisplay: this.getTypeDisplay(),
      icon: this.getIcon(),
      priority: this.getPriority(),
      timeAgo: this.getTimeAgo()
    };
  };

  // Static methods
  Notification.createJobAssignment = function(userId, jobId, jobType, location) {
    return this.create({
      user_id: userId,
      title: 'New Job Assignment',
      message: `You have been assigned a new ${jobType} job at ${location}`,
      type: 'job_assignment',
      related_job_id: jobId
    });
  };

  Notification.createStatusUpdate = function(userId, orderId, oldStatus, newStatus) {
    return this.create({
      user_id: userId,
      title: 'Order Status Update',
      message: `Your order status has been updated from ${oldStatus} to ${newStatus}`,
      type: 'status_update',
      related_order_id: orderId
    });
  };

  return Notification;
};