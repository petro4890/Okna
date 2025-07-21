const { DataTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = (sequelize) => {
  const PasswordResetToken = sequelize.define('PasswordResetToken', {
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
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'password_reset_tokens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    hooks: {
      beforeCreate: (token) => {
        if (!token.token) {
          // Generate a secure random token
          token.token = crypto.randomBytes(32).toString('hex');
        }
        if (!token.expires_at) {
          // Set expiration to 1 hour from now
          token.expires_at = new Date(Date.now() + 60 * 60 * 1000);
        }
      }
    }
  });

  // Instance methods
  PasswordResetToken.prototype.isExpired = function() {
    return new Date() > this.expires_at;
  };

  PasswordResetToken.prototype.isValid = function() {
    return !this.used && !this.isExpired();
  };

  PasswordResetToken.prototype.markAsUsed = function() {
    this.used = true;
    return this.save();
  };

  PasswordResetToken.prototype.getTimeUntilExpiry = function() {
    const now = new Date();
    const expiry = new Date(this.expires_at);
    const diffMs = expiry - now;
    
    if (diffMs <= 0) return 'Expired';
    
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    }
    return `${diffMins}m`;
  };

  // Static methods
  PasswordResetToken.generateForUser = function(userId, expirationHours = 1) {
    return this.create({
      user_id: userId,
      expires_at: new Date(Date.now() + expirationHours * 60 * 60 * 1000)
    });
  };

  PasswordResetToken.findValidToken = function(token) {
    return this.findOne({
      where: {
        token: token,
        used: false,
        expires_at: {
          [sequelize.Sequelize.Op.gt]: new Date()
        }
      },
      include: [{
        model: sequelize.models.User,
        as: 'user'
      }]
    });
  };

  PasswordResetToken.cleanupExpired = function() {
    return this.destroy({
      where: {
        expires_at: {
          [sequelize.Sequelize.Op.lt]: new Date()
        }
      }
    });
  };

  PasswordResetToken.revokeAllForUser = function(userId) {
    return this.update(
      { used: true },
      {
        where: {
          user_id: userId,
          used: false
        }
      }
    );
  };

  return PasswordResetToken;
};