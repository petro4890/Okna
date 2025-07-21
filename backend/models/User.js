const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    phone_number: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: true,
      validate: {
        is: /^[\+]?[1-9][\d]{0,15}$/
      }
    },
    username: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: true,
      validate: {
        len: [3, 100],
        isAlphanumeric: true
      }
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM(
        'director',
        'manager',
        'supervisor',
        'measurer',
        'delivery_person',
        'installer',
        'client'
      ),
      allowNull: false
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100]
      }
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100]
      }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    phone_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true
    },
    profile_image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true
      }
    }
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    validate: {
      // Ensure at least one login method exists
      hasLoginMethod() {
        if (!this.email && !this.phone_number && !this.username) {
          throw new Error('At least one login method (email, phone, or username) must be provided');
        }
      }
    },
    hooks: {
      beforeValidate: (user) => {
        // Trim whitespace from string fields
        if (user.email) user.email = user.email.trim().toLowerCase();
        if (user.username) user.username = user.username.trim().toLowerCase();
        if (user.first_name) user.first_name = user.first_name.trim();
        if (user.last_name) user.last_name = user.last_name.trim();
        if (user.phone_number) user.phone_number = user.phone_number.trim();
      }
    }
  });

  // Instance methods
  User.prototype.getFullName = function() {
    return `${this.first_name} ${this.last_name}`;
  };

  User.prototype.canManageUsers = function() {
    return ['director', 'manager'].includes(this.role);
  };

  User.prototype.canViewAllProjects = function() {
    return ['director', 'manager', 'supervisor'].includes(this.role);
  };

  User.prototype.isWorker = function() {
    return ['measurer', 'delivery_person', 'installer'].includes(this.role);
  };

  User.prototype.isClient = function() {
    return this.role === 'client';
  };

  User.prototype.toSafeJSON = function() {
    const values = Object.assign({}, this.get());
    delete values.password_hash;
    return values;
  };

  return User;
};