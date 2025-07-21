const { DataTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = (sequelize) => {
  const UserSession = sequelize.define('UserSession', {
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
    token_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    device_info: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Device information like OS, browser, app version'
    },
    ip_address: {
      type: DataTypes.INET,
      allowNull: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'user_sessions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    hooks: {
      beforeCreate: (session) => {
        if (!session.expires_at) {
          // Set expiration to 7 days from now (default JWT expiration)
          session.expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }
      }
    }
  });

  // Instance methods
  UserSession.prototype.isExpired = function() {
    return new Date() > this.expires_at;
  };

  UserSession.prototype.isValid = function() {
    return !this.isExpired();
  };

  UserSession.prototype.getDeviceName = function() {
    if (!this.device_info) return 'Unknown Device';
    
    const info = this.device_info;
    const parts = [];
    
    if (info.platform) parts.push(info.platform);
    if (info.browser) parts.push(info.browser);
    if (info.version) parts.push(`v${info.version}`);
    
    return parts.length > 0 ? parts.join(' ') : 'Unknown Device';
  };

  UserSession.prototype.getLocationInfo = function() {
    if (!this.ip_address) return 'Unknown Location';
    
    // In a real application, you might use a GeoIP service here
    return `IP: ${this.ip_address}`;
  };

  UserSession.prototype.getTimeUntilExpiry = function() {
    const now = new Date();
    const expiry = new Date(this.expires_at);
    const diffMs = expiry - now;
    
    if (diffMs <= 0) return 'Expired';
    
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const diffHours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h`;
    }
    return `${diffHours}h`;
  };

  UserSession.prototype.extendExpiry = function(days = 7) {
    this.expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return this.save();
  };

  UserSession.prototype.revoke = function() {
    return this.destroy();
  };

  // Static methods
  UserSession.createForUser = function(userId, tokenHash, deviceInfo = null, ipAddress = null, expirationDays = 7) {
    return this.create({
      user_id: userId,
      token_hash: tokenHash,
      device_info: deviceInfo,
      ip_address: ipAddress,
      expires_at: new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)
    });
  };

  UserSession.findByTokenHash = function(tokenHash) {
    return this.findOne({
      where: {
        token_hash: tokenHash,
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

  UserSession.cleanupExpired = function() {
    return this.destroy({
      where: {
        expires_at: {
          [sequelize.Sequelize.Op.lt]: new Date()
        }
      }
    });
  };

  UserSession.revokeAllForUser = function(userId, exceptSessionId = null) {
    const whereClause = { user_id: userId };
    
    if (exceptSessionId) {
      whereClause.id = {
        [sequelize.Sequelize.Op.ne]: exceptSessionId
      };
    }
    
    return this.destroy({ where: whereClause });
  };

  UserSession.getUserActiveSessions = function(userId) {
    return this.findAll({
      where: {
        user_id: userId,
        expires_at: {
          [sequelize.Sequelize.Op.gt]: new Date()
        }
      },
      order: [['created_at', 'DESC']]
    });
  };

  UserSession.hashToken = function(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  };

  return UserSession;
};