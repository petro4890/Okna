const express = require('express');
const { body, validationResult } = require('express-validator');
const { CompanyInfo, YoutubeVideo } = require('../models');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get company information (Public endpoint)
router.get('/info', async (req, res) => {
  try {
    const company = await CompanyInfo.getCompanyInfo();
    res.json({ company: company.toPublicJSON() });
  } catch (error) {
    console.error('Get company info error:', error);
    res.status(500).json({ error: 'Failed to fetch company information' });
  }
});

// Update company information (Admin only)
router.put('/info', authenticateToken, requireAdmin, [
  body('name').optional().isLength({ min: 1, max: 255 }).trim(),
  body('website').optional().isURL(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isMobilePhone(),
  body('address').optional().isLength({ max: 1000 }).trim(),
  body('youtube_channel_id').optional().isLength({ max: 100 }).trim(),
  body('about_text').optional().isLength({ max: 5000 }).trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updateData = req.body;
    const company = await CompanyInfo.updateCompanyInfo(updateData);

    res.json({
      message: 'Company information updated successfully',
      company: company.toPublicJSON()
    });

  } catch (error) {
    console.error('Update company info error:', error);
    res.status(500).json({ error: 'Failed to update company information' });
  }
});

// Get YouTube videos (Public endpoint)
router.get('/videos', async (req, res) => {
  try {
    const videos = await YoutubeVideo.getActiveVideos();
    const videosData = videos.map(video => video.toPublicJSON());

    res.json({ videos: videosData });
  } catch (error) {
    console.error('Get YouTube videos error:', error);
    res.status(500).json({ error: 'Failed to fetch YouTube videos' });
  }
});

// Add YouTube video (Admin only)
router.post('/videos', authenticateToken, requireAdmin, [
  body('video_id').isLength({ min: 11, max: 11 }).withMessage('Valid YouTube video ID is required'),
  body('title').isLength({ min: 1, max: 255 }).trim(),
  body('description').optional().isLength({ max: 1000 }).trim(),
  body('display_order').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { video_id, title, description, display_order } = req.body;

    // Check if video already exists
    const existingVideo = await YoutubeVideo.getByVideoId(video_id);
    if (existingVideo) {
      return res.status(409).json({ error: 'Video already exists' });
    }

    // Generate thumbnail URL
    const thumbnail_url = `https://img.youtube.com/vi/${video_id}/maxresdefault.jpg`;

    const video = await YoutubeVideo.addVideo({
      video_id,
      title,
      description,
      thumbnail_url,
      display_order: display_order || 0
    });

    res.status(201).json({
      message: 'YouTube video added successfully',
      video: video.toPublicJSON()
    });

  } catch (error) {
    console.error('Add YouTube video error:', error);
    res.status(500).json({ error: 'Failed to add YouTube video' });
  }
});

// Update YouTube video (Admin only)
router.put('/videos/:videoId', authenticateToken, requireAdmin, [
  body('title').optional().isLength({ min: 1, max: 255 }).trim(),
  body('description').optional().isLength({ max: 1000 }).trim(),
  body('display_order').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { videoId } = req.params;
    const updateData = req.body;

    const video = await YoutubeVideo.findByPk(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    await video.update(updateData);

    res.json({
      message: 'YouTube video updated successfully',
      video: video.toPublicJSON()
    });

  } catch (error) {
    console.error('Update YouTube video error:', error);
    res.status(500).json({ error: 'Failed to update YouTube video' });
  }
});

// Update video display order (Admin only)
router.put('/videos/reorder', authenticateToken, requireAdmin, [
  body('videos').isArray({ min: 1 }).withMessage('Videos array is required'),
  body('videos.*.id').isUUID().withMessage('Valid video ID is required'),
  body('videos.*.display_order').isInt({ min: 0 }).withMessage('Valid display order is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { videos } = req.body;

    await YoutubeVideo.updateDisplayOrder(videos);

    res.json({ message: 'Video display order updated successfully' });

  } catch (error) {
    console.error('Update video order error:', error);
    res.status(500).json({ error: 'Failed to update video display order' });
  }
});

// Activate/Deactivate YouTube video (Admin only)
router.put('/videos/:videoId/status', authenticateToken, requireAdmin, [
  body('is_active').isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { videoId } = req.params;
    const { is_active } = req.body;

    const video = await YoutubeVideo.findByPk(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (is_active) {
      await video.activate();
    } else {
      await video.deactivate();
    }

    res.json({
      message: `Video ${is_active ? 'activated' : 'deactivated'} successfully`,
      video: video.toPublicJSON()
    });

  } catch (error) {
    console.error('Update video status error:', error);
    res.status(500).json({ error: 'Failed to update video status' });
  }
});

// Delete YouTube video (Admin only)
router.delete('/videos/:videoId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { videoId } = req.params;

    const video = await YoutubeVideo.findByPk(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    await video.destroy();

    res.json({ message: 'YouTube video deleted successfully' });

  } catch (error) {
    console.error('Delete YouTube video error:', error);
    res.status(500).json({ error: 'Failed to delete YouTube video' });
  }
});

// Get about us page data (Public endpoint)
router.get('/about', async (req, res) => {
  try {
    const [company, videos] = await Promise.all([
      CompanyInfo.getCompanyInfo(),
      YoutubeVideo.getActiveVideos()
    ]);

    const aboutData = {
      company: company.toPublicJSON(),
      videos: videos.map(video => video.toPublicJSON()),
      sections: {
        about_text: company.about_text,
        contact_info: {
          name: company.name,
          email: company.email,
          phone: company.getFormattedPhone(),
          address: company.address,
          website: company.website
        },
        youtube_videos: videos.map(video => ({
          id: video.id,
          video_id: video.video_id,
          title: video.title,
          description: video.getShortDescription(),
          thumbnail_url: video.getThumbnailUrl(),
          embed_url: video.getEmbedUrl(),
          duration: video.getFormattedDuration()
        }))
      }
    };

    res.json(aboutData);

  } catch (error) {
    console.error('Get about page error:', error);
    res.status(500).json({ error: 'Failed to fetch about page data' });
  }
});

// Get contact information (Public endpoint)
router.get('/contact', async (req, res) => {
  try {
    const company = await CompanyInfo.getCompanyInfo();

    const contactData = {
      name: company.name,
      email: company.email,
      phone: company.getFormattedPhone(),
      address: company.address,
      website: company.website,
      contact_methods: company.getContactMethods(),
      business_hours: {
        monday: '8:00 AM - 6:00 PM',
        tuesday: '8:00 AM - 6:00 PM',
        wednesday: '8:00 AM - 6:00 PM',
        thursday: '8:00 AM - 6:00 PM',
        friday: '8:00 AM - 6:00 PM',
        saturday: '9:00 AM - 4:00 PM',
        sunday: 'Closed'
      },
      emergency_contact: company.phone // Same as main phone for now
    };

    res.json({ contact: contactData });

  } catch (error) {
    console.error('Get contact info error:', error);
    res.status(500).json({ error: 'Failed to fetch contact information' });
  }
});

// Search functionality for company content
router.get('/search', async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters long' });
    }

    const searchTerm = query.trim();

    // Search in company info and videos
    const [company, videos] = await Promise.all([
      CompanyInfo.getCompanyInfo(),
      YoutubeVideo.findAll({
        where: {
          is_active: true,
          [require('sequelize').Op.or]: [
            { title: { [require('sequelize').Op.iLike]: `%${searchTerm}%` } },
            { description: { [require('sequelize').Op.iLike]: `%${searchTerm}%` } }
          ]
        },
        order: [['display_order', 'ASC']]
      })
    ]);

    const results = {
      company_info: null,
      videos: []
    };

    // Check if company info matches
    if (
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (company.about_text && company.about_text.toLowerCase().includes(searchTerm.toLowerCase()))
    ) {
      results.company_info = company.toPublicJSON();
    }

    // Add matching videos
    results.videos = videos.map(video => video.toPublicJSON());

    res.json({
      query: searchTerm,
      results,
      total_results: (results.company_info ? 1 : 0) + results.videos.length
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;