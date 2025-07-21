const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    order_number: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false
    },
    client_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'clients',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    assigned_manager_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM(
        'pending',
        'measuring_scheduled',
        'measuring_in_progress',
        'measuring_completed',
        'production_scheduled',
        'in_production',
        'production_completed',
        'delivery_scheduled',
        'in_delivery',
        'delivered',
        'installation_scheduled',
        'installation_in_progress',
        'installation_completed',
        'completed',
        'cancelled'
      ),
      defaultValue: 'pending'
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0
      }
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD'
    },
    order_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    estimated_completion_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    actual_completion_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    crm_order_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true
    }
  }, {
    tableName: 'orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      beforeCreate: async (order) => {
        if (!order.order_number) {
          // Generate order number: WM-YYYY-NNNNNN
          const year = new Date().getFullYear();
          const count = await Order.count({
            where: sequelize.where(
              sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM created_at')),
              year
            )
          });
          order.order_number = `WM-${year}-${String(count + 1).padStart(6, '0')}`;
        }
      },
      beforeValidate: (order) => {
        if (order.notes) order.notes = order.notes.trim();
        if (order.currency) order.currency = order.currency.toUpperCase();
      }
    }
  });

  // Instance methods
  Order.prototype.getStatusDisplay = function() {
    const statusMap = {
      'pending': 'Pending',
      'measuring_scheduled': 'Measuring Scheduled',
      'measuring_in_progress': 'Measuring in Progress',
      'measuring_completed': 'Measuring Completed',
      'production_scheduled': 'Production Scheduled',
      'in_production': 'In Production',
      'production_completed': 'Production Completed',
      'delivery_scheduled': 'Delivery Scheduled',
      'in_delivery': 'In Delivery',
      'delivered': 'Delivered',
      'installation_scheduled': 'Installation Scheduled',
      'installation_in_progress': 'Installation in Progress',
      'installation_completed': 'Installation Completed',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return statusMap[this.status] || this.status;
  };

  Order.prototype.isActive = function() {
    return !['completed', 'cancelled'].includes(this.status);
  };

  Order.prototype.canBeCancelled = function() {
    return !['completed', 'cancelled', 'installation_completed'].includes(this.status);
  };

  Order.prototype.getProgressPercentage = function() {
    const statusProgress = {
      'pending': 5,
      'measuring_scheduled': 10,
      'measuring_in_progress': 15,
      'measuring_completed': 25,
      'production_scheduled': 30,
      'in_production': 50,
      'production_completed': 70,
      'delivery_scheduled': 75,
      'in_delivery': 80,
      'delivered': 85,
      'installation_scheduled': 90,
      'installation_in_progress': 95,
      'installation_completed': 98,
      'completed': 100,
      'cancelled': 0
    };
    return statusProgress[this.status] || 0;
  };

  Order.prototype.getCurrentWorker = function() {
    // This would need to be implemented with job associations
    // Returns the currently assigned worker based on status
    const workerTypes = {
      'measuring_scheduled': 'measurer',
      'measuring_in_progress': 'measurer',
      'delivery_scheduled': 'delivery_person',
      'in_delivery': 'delivery_person',
      'installation_scheduled': 'installer',
      'installation_in_progress': 'installer'
    };
    return workerTypes[this.status] || null;
  };

  return Order;
};