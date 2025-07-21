const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CompanyInfo = sequelize.define('CompanyInfo', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [1, 255]
      }
    },
    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        is: /^[\+]?[1-9][\d]{0,15}$/
      }
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    youtube_channel_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'YouTube channel ID for fetching videos'
    },
    about_text: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Company description for About Us section'
    }
  }, {
    tableName: 'company_info',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      beforeValidate: (company) => {
        if (company.name) company.name = company.name.trim();
        if (company.website) company.website = company.website.trim();
        if (company.email) company.email = company.email.trim().toLowerCase();
        if (company.phone) company.phone = company.phone.trim();
        if (company.address) company.address = company.address.trim();
        if (company.youtube_channel_id) company.youtube_channel_id = company.youtube_channel_id.trim();
        if (company.about_text) company.about_text = company.about_text.trim();
      }
    }
  });

  // Instance methods
  CompanyInfo.prototype.getFormattedPhone = function() {
    if (!this.phone) return null;
    
    // Simple US phone number formatting
    const cleaned = this.phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return this.phone;
  };

  CompanyInfo.prototype.getYouTubeChannelUrl = function() {
    if (!this.youtube_channel_id) return null;
    return `https://www.youtube.com/channel/${this.youtube_channel_id}`;
  };

  CompanyInfo.prototype.hasContactInfo = function() {
    return !!(this.email || this.phone || this.address);
  };

  CompanyInfo.prototype.getContactMethods = function() {
    const methods = [];
    
    if (this.email) {
      methods.push({
        type: 'email',
        label: 'Email',
        value: this.email,
        link: `mailto:${this.email}`
      });
    }
    
    if (this.phone) {
      methods.push({
        type: 'phone',
        label: 'Phone',
        value: this.getFormattedPhone(),
        link: `tel:${this.phone}`
      });
    }
    
    if (this.website) {
      methods.push({
        type: 'website',
        label: 'Website',
        value: this.website,
        link: this.website
      });
    }
    
    return methods;
  };

  CompanyInfo.prototype.toPublicJSON = function() {
    return {
      id: this.id,
      name: this.name,
      website: this.website,
      email: this.email,
      phone: this.getFormattedPhone(),
      address: this.address,
      about_text: this.about_text,
      youtube_channel_url: this.getYouTubeChannelUrl(),
      contact_methods: this.getContactMethods()
    };
  };

  // Static methods
  CompanyInfo.getCompanyInfo = async function() {
    // Get the first (and should be only) company info record
    let company = await this.findOne();
    
    if (!company) {
      // Create default company info if none exists
      company = await this.create({
        name: 'Window Manufacturing Company',
        about_text: 'We are a leading window manufacturing company with over 20 years of experience in providing high-quality windows and professional installation services.'
      });
    }
    
    return company;
  };

  CompanyInfo.updateCompanyInfo = async function(updateData) {
    let company = await this.findOne();
    
    if (!company) {
      return this.create(updateData);
    } else {
      return company.update(updateData);
    }
  };

  return CompanyInfo;
};