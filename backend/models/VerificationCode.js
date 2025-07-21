const { DataTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = (sequelize) => {
  const VerificationCode = sequelize.define('VerificationCode', {
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
    code: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['email', 'sms']]
      }
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
    tableName: 'verification_codes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    hooks: {
      beforeCreate: (verificationCode) => {
        if (!verificationCode.code) {
          // Generate a 6-digit numeric code
          verificationCode.code = Math.floor(100000 + Math.random() * 900000).toString();
        }
        if (!verificationCode.expires_at) {
          // Set expiration to 15 minutes from now
          verificationCode.expires_at = new Date(Date.now() + 15 * 60 * 1000);
        }
      },
      beforeValidate: (verificationCode) => {
        if (verificationCode.type) verificationCode.type = verificationCode.type.toLowerCase();
      }
    }
  });

  // Instance methods
  VerificationCode.prototype.isExpired = function() {
    return new Date() > this.expires_at;
  };

  VerificationCode.prototype.isValid = function() {
    return !this.used && !this.isExpired();
  };

  VerificationCode.prototype.markAsUsed = function() {
    this.used = true;
    return this.save();
  };

  VerificationCode.prototype.getTimeUntilExpiry = function() {
    const now = new Date();
    const expiry = new Date(this.expires_at);
    const diffMs = expiry - now;
    
    if (diffMs <= 0) return 'Expired';
    
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    
    if (diffMins > 0) {
      return `${diffMins}m ${diffSecs}s`;
    }
    return `${diffSecs}s`;
  };

  VerificationCode.prototype.getTypeDisplay = function() {
    const typeMap = {
      'email': 'Email',
      'sms': 'SMS'
    };
    return typeMap[this.type] || this.type;
  };

  // Static methods
  VerificationCode.generateForUser = function(userId, type, expirationMinutes = 15) {
    return this.create({
      user_id: userId,
      type: type,
      expires_at: new Date(Date.now() + expirationMinutes * 60 * 1000)
    });
  };

  VerificationCode.findValidCode = function(userId, code, type) {
    return this.findOne({
      where: {
        user_id: userId,
        code: code,
        type: type,
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

  VerificationCode.cleanupExpired = function() {
    return this.destroy({
      where: {
        expires_at: {
          [sequelize.Sequelize.Op.lt]: new Date()
        }
      }
    });
  };

  VerificationCode.revokeAllForUser = function(userId, type = null) {
    const whereClause = {
      user_id: userId,
      used: false
    };
    
    if (type) {
      whereClause.type = type;
    }
    
    return this.update(
      { used: true },
      { where: whereClause }
    );
  };

  VerificationCode.getRecentAttemptsCount = function(userId, type, minutesBack = 60) {
    const timeThreshold = new Date(Date.now() - minutesBack * 60 * 1000);
    
    return this.count({
      where: {
        user_id: userId,
        type: type,
        created_at: {
          [sequelize.Sequelize.Op.gte]: timeThreshold
        }
      }
    });
  };

  VerificationCode.canSendNewCode = function(userId, type, maxAttemptsPerHour = 5) {
    return this.getRecentAttemptsCount(userId, type, 60)
      .then(count => count < maxAttemptsPerHour);
  };

  return VerificationCode;
};