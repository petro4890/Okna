const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const JobStatusUpdate = sequelize.define('JobStatusUpdate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    job_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'jobs',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    previous_status: {
      type: DataTypes.ENUM(
        'assigned',
        'en_route',
        'arrived',
        'in_progress',
        'completed',
        'cancelled'
      ),
      allowNull: true
    },
    new_status: {
      type: DataTypes.ENUM(
        'assigned',
        'en_route',
        'arrived',
        'in_progress',
        'completed',
        'cancelled'
      ),
      allowNull: false
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    location_coordinates: {
      type: DataTypes.GEOMETRY('POINT'),
      allowNull: true,
      comment: 'GPS coordinates when status was updated'
    }
  }, {
    tableName: 'job_status_updates',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    hooks: {
      beforeValidate: (update) => {
        if (update.notes) update.notes = update.notes.trim();
      }
    }
  });

  // Instance methods
  JobStatusUpdate.prototype.getStatusDisplay = function(status) {
    const statusMap = {
      'assigned': 'Assigned',
      'en_route': 'En Route',
      'arrived': 'Arrived',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
  };

  JobStatusUpdate.prototype.getPreviousStatusDisplay = function() {
    return this.previous_status ? this.getStatusDisplay(this.previous_status) : 'N/A';
  };

  JobStatusUpdate.prototype.getNewStatusDisplay = function() {
    return this.getStatusDisplay(this.new_status);
  };

  JobStatusUpdate.prototype.getUpdateMessage = function() {
    const previous = this.getPreviousStatusDisplay();
    const current = this.getNewStatusDisplay();
    
    if (this.previous_status) {
      return `Status changed from ${previous} to ${current}`;
    } else {
      return `Status set to ${current}`;
    }
  };

  JobStatusUpdate.prototype.hasLocationData = function() {
    return this.location_coordinates !== null;
  };

  JobStatusUpdate.prototype.getLocationCoordinates = function() {
    if (!this.location_coordinates) return null;
    
    // Extract coordinates from PostGIS POINT
    if (this.location_coordinates.coordinates) {
      return {
        longitude: this.location_coordinates.coordinates[0],
        latitude: this.location_coordinates.coordinates[1]
      };
    }
    return null;
  };

  JobStatusUpdate.prototype.isSignificantUpdate = function() {
    // Define which status changes are significant for notifications
    const significantStatuses = ['arrived', 'in_progress', 'completed', 'cancelled'];
    return significantStatuses.includes(this.new_status);
  };

  return JobStatusUpdate;
};