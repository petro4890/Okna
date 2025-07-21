const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OrderItem = sequelize.define('OrderItem', {
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
    product_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [1, 255]
      }
    },
    product_type: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1
      }
    },
    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0
      }
    },
    total_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0
      }
    },
    specifications: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Product specifications stored as JSON'
    }
  }, {
    tableName: 'order_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    hooks: {
      beforeValidate: (item) => {
        if (item.product_name) item.product_name = item.product_name.trim();
        if (item.product_type) item.product_type = item.product_type.trim();
      },
      beforeSave: (item) => {
        // Auto-calculate total price if unit price is provided
        if (item.unit_price && item.quantity) {
          item.total_price = (parseFloat(item.unit_price) * item.quantity).toFixed(2);
        }
      }
    }
  });

  // Instance methods
  OrderItem.prototype.getFormattedPrice = function(currency = 'USD') {
    if (!this.unit_price) return 'N/A';
    
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    });
    return formatter.format(this.unit_price);
  };

  OrderItem.prototype.getFormattedTotalPrice = function(currency = 'USD') {
    if (!this.total_price) return 'N/A';
    
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    });
    return formatter.format(this.total_price);
  };

  OrderItem.prototype.getSpecification = function(key) {
    if (!this.specifications || typeof this.specifications !== 'object') {
      return null;
    }
    return this.specifications[key] || null;
  };

  OrderItem.prototype.setSpecification = function(key, value) {
    if (!this.specifications) {
      this.specifications = {};
    }
    this.specifications[key] = value;
    this.changed('specifications', true);
  };

  OrderItem.prototype.getDisplayName = function() {
    if (this.product_type) {
      return `${this.product_name} (${this.product_type})`;
    }
    return this.product_name;
  };

  return OrderItem;
};