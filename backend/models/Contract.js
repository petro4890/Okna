const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Contract = sequelize.define('Contract', {
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
    contract_number: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false
    },
    contract_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['service_agreement', 'installation_contract', 'warranty', 'amendment']]
      }
    },
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Local file path for the contract document'
    },
    file_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Public URL for the contract document'
    },
    signed_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    is_signed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'contracts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      beforeCreate: async (contract) => {
        if (!contract.contract_number) {
          // Generate contract number: CT-YYYY-NNNNNN
          const year = new Date().getFullYear();
          const count = await Contract.count({
            where: sequelize.where(
              sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM created_at')),
              year
            )
          });
          contract.contract_number = `CT-${year}-${String(count + 1).padStart(6, '0')}`;
        }
      },
      beforeValidate: (contract) => {
        if (contract.contract_type) contract.contract_type = contract.contract_type.toLowerCase();
      }
    }
  });

  // Instance methods
  Contract.prototype.getContractTypeDisplay = function() {
    const typeMap = {
      'service_agreement': 'Service Agreement',
      'installation_contract': 'Installation Contract',
      'warranty': 'Warranty',
      'amendment': 'Amendment'
    };
    return typeMap[this.contract_type] || this.contract_type;
  };

  Contract.prototype.getFileName = function() {
    if (this.file_path) {
      return this.file_path.split('/').pop();
    }
    return `${this.contract_number}.pdf`;
  };

  Contract.prototype.getFileExtension = function() {
    const fileName = this.getFileName();
    return fileName.split('.').pop().toLowerCase();
  };

  Contract.prototype.isPDF = function() {
    return this.getFileExtension() === 'pdf';
  };

  Contract.prototype.hasFile = function() {
    return !!(this.file_path || this.file_url);
  };

  Contract.prototype.getDownloadUrl = function() {
    if (this.file_url) {
      return this.file_url;
    }
    if (this.file_path) {
      // Assuming files are served from /uploads endpoint
      return `/uploads/contracts/${this.getFileName()}`;
    }
    return null;
  };

  Contract.prototype.canBeSigned = function() {
    return this.hasFile() && !this.is_signed;
  };

  Contract.prototype.markAsSigned = function() {
    this.is_signed = true;
    this.signed_date = new Date();
  };

  Contract.prototype.getStatusDisplay = function() {
    if (this.is_signed) {
      return `Signed on ${this.signed_date}`;
    }
    if (this.hasFile()) {
      return 'Pending Signature';
    }
    return 'Draft';
  };

  return Contract;
};