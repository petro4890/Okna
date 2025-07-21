const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Client = sequelize.define('Client', {
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
    client_type: {
      type: DataTypes.ENUM('individual', 'legal_entity'),
      allowNull: false
    },
    company_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isRequiredForLegalEntity(value) {
          if (this.client_type === 'legal_entity' && !value) {
            throw new Error('Company name is required for legal entities');
          }
        }
      }
    },
    tax_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        isRequiredForLegalEntity(value) {
          if (this.client_type === 'legal_entity' && !value) {
            throw new Error('Tax ID is required for legal entities');
          }
        }
      }
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [5, 500]
      }
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100]
      }
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    postal_code: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    country: {
      type: DataTypes.STRING(100),
      defaultValue: 'USA'
    },
    assigned_manager_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    crm_customer_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true
    }
  }, {
    tableName: 'clients',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      beforeValidate: (client) => {
        // Trim whitespace from string fields
        if (client.company_name) client.company_name = client.company_name.trim();
        if (client.tax_id) client.tax_id = client.tax_id.trim();
        if (client.address) client.address = client.address.trim();
        if (client.city) client.city = client.city.trim();
        if (client.state) client.state = client.state.trim();
        if (client.postal_code) client.postal_code = client.postal_code.trim();
        if (client.country) client.country = client.country.trim();
      }
    }
  });

  // Instance methods
  Client.prototype.getDisplayName = function() {
    if (this.client_type === 'legal_entity') {
      return this.company_name;
    }
    // Will need to access associated user for individual name
    return 'Individual Client';
  };

  Client.prototype.getFullAddress = function() {
    const parts = [this.address, this.city];
    if (this.state) parts.push(this.state);
    if (this.postal_code) parts.push(this.postal_code);
    if (this.country && this.country !== 'USA') parts.push(this.country);
    return parts.join(', ');
  };

  Client.prototype.isLegalEntity = function() {
    return this.client_type === 'legal_entity';
  };

  return Client;
};