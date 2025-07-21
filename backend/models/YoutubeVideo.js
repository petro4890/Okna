const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const YoutubeVideo = sequelize.define('YoutubeVideo', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    video_id: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: 'YouTube video ID'
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [1, 255]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    thumbnail_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    duration: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Video duration in format like "PT4M13S" or "4:13"'
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    display_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Order for displaying videos in the app'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether to show this video in the app'
    }
  }, {
    tableName: 'youtube_videos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    hooks: {
      beforeValidate: (video) => {
        if (video.video_id) video.video_id = video.video_id.trim();
        if (video.title) video.title = video.title.trim();
        if (video.description) video.description = video.description.trim();
        if (video.thumbnail_url) video.thumbnail_url = video.thumbnail_url.trim();
        if (video.duration) video.duration = video.duration.trim();
      }
    }
  });

  // Instance methods
  YoutubeVideo.prototype.getVideoUrl = function() {
    return `https://www.youtube.com/watch?v=${this.video_id}`;
  };

  YoutubeVideo.prototype.getEmbedUrl = function() {
    return `https://www.youtube.com/embed/${this.video_id}`;
  };

  YoutubeVideo.prototype.getThumbnailUrl = function(quality = 'maxresdefault') {
    if (this.thumbnail_url) {
      return this.thumbnail_url;
    }
    
    // Generate YouTube thumbnail URL
    const qualities = {
      'default': 'default.jpg',
      'medium': 'mqdefault.jpg',
      'high': 'hqdefault.jpg',
      'standard': 'sddefault.jpg',
      'maxres': 'maxresdefault.jpg'
    };
    
    const filename = qualities[quality] || qualities['maxres'];
    return `https://img.youtube.com/vi/${this.video_id}/${filename}`;
  };

  YoutubeVideo.prototype.getFormattedDuration = function() {
    if (!this.duration) return null;
    
    // Convert ISO 8601 duration (PT4M13S) to readable format (4:13)
    if (this.duration.startsWith('PT')) {
      const match = this.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        const hours = parseInt(match[1]) || 0;
        const minutes = parseInt(match[2]) || 0;
        const seconds = parseInt(match[3]) || 0;
        
        if (hours > 0) {
          return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
          return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
      }
    }
    
    // Return as-is if already in readable format
    return this.duration;
  };

  YoutubeVideo.prototype.getShortDescription = function(maxLength = 150) {
    if (!this.description) return '';
    
    if (this.description.length <= maxLength) {
      return this.description;
    }
    
    return this.description.substring(0, maxLength).trim() + '...';
  };

  YoutubeVideo.prototype.activate = function() {
    this.is_active = true;
    return this.save();
  };

  YoutubeVideo.prototype.deactivate = function() {
    this.is_active = false;
    return this.save();
  };

  YoutubeVideo.prototype.toPublicJSON = function() {
    return {
      id: this.id,
      video_id: this.video_id,
      title: this.title,
      description: this.description,
      short_description: this.getShortDescription(),
      thumbnail_url: this.getThumbnailUrl(),
      duration: this.getFormattedDuration(),
      published_at: this.published_at,
      video_url: this.getVideoUrl(),
      embed_url: this.getEmbedUrl(),
      display_order: this.display_order
    };
  };

  // Static methods
  YoutubeVideo.getActiveVideos = function() {
    return this.findAll({
      where: { is_active: true },
      order: [['display_order', 'ASC'], ['created_at', 'ASC']]
    });
  };

  YoutubeVideo.addVideo = function(videoData) {
    return this.create({
      video_id: videoData.video_id,
      title: videoData.title,
      description: videoData.description,
      thumbnail_url: videoData.thumbnail_url,
      duration: videoData.duration,
      published_at: videoData.published_at,
      display_order: videoData.display_order || 0
    });
  };

  YoutubeVideo.updateDisplayOrder = async function(videoOrders) {
    // videoOrders should be an array of {id, display_order}
    const promises = videoOrders.map(item => 
      this.update(
        { display_order: item.display_order },
        { where: { id: item.id } }
      )
    );
    
    return Promise.all(promises);
  };

  YoutubeVideo.getByVideoId = function(videoId) {
    return this.findOne({
      where: { video_id: videoId }
    });
  };

  return YoutubeVideo;
};